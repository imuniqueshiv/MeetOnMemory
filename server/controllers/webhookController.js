import mongoose from "mongoose";
import { URL } from "url";
import { z } from "zod";
import Webhook from "../models/Webhook.js";
import WebhookDelivery from "../models/WebhookDelivery.js";
import { redeliverWebhookDelivery } from "../services/webhookDispatcherService.js";
import Membership from "../models/membershipModel.js";
import Organization from "../models/organizationModel.js";
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "../utils/errors.js";
import { sendSuccess } from "../utils/responseHandler.js";

import dns from "dns/promises";
import ipaddr from "ipaddr.js";

const isSafeWebhookUrl = async (urlStr) => {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();

    // Block obvious localhosts immediately
    if (hostname === "localhost" || hostname === "localhost.localdomain") {
      return false;
    }

    // Resolve the hostname to an IP address
    let resolvedIp;
    try {
      // dns.lookup checks /etc/hosts and DNS, returning the IP
      const { address } = await dns.lookup(hostname);
      resolvedIp = address;
    } catch (_err) {
      // If we can't resolve it, it's not a valid safe public URL
      return false;
    }

    // Parse the resolved IP using ipaddr.js
    let addr;
    try {
      addr = ipaddr.parse(resolvedIp);
    } catch (_err) {
      return false;
    }

    // Check if the address is in a private, loopback, link-local, or otherwise restricted range
    const range = addr.range();

    // ipaddr.js classifies public addresses as 'unicast'
    // Private ranges are classified as 'private', 'loopback', 'linkLocal', etc.
    if (range !== "unicast") {
      return false;
    }

    // Explicitly block known IPv4 mapped IPv6 loopbacks just in case
    if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) {
      const v4addr = addr.toIPv4Address();
      if (v4addr.range() !== "unicast") {
        return false;
      }
    }

    return true;
  } catch (_err) {
    return false;
  }
};

// Helper to verify user permissions (must be Owner or Admin of the target Organization)
const hasAdminPermission = async (userId, organizationId) => {
  if (!organizationId) return false;

  try {
    const org = await Organization.findById(organizationId);
    if (!org) return false;

    // Check if user is the direct owner of the organization
    if (org.owner.toString() === userId.toString()) {
      return true;
    }

    // Check if user has an active admin membership role
    const membership = await Membership.findOne({
      user: userId,
      organization: organizationId,
      role: "admin",
      status: "active",
    }).lean();

    return !!membership;
  } catch (err) {
    console.error("Error checking permissions:", err);
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════
// Zod schemas for payload validation
// ═══════════════════════════════════════════════════════════════

const createWebhookSchema = z.object({
  targetUrl: z
    .string({ required_error: "Target URL is required." })
    .trim()
    .min(1, "Target URL cannot be empty.")
    .refine((url) => url.startsWith("http://") || url.startsWith("https://"), {
      message: "Target URL must start with http:// or https://.",
    })
    .refine((url) => isSafeWebhookUrl(url), {
      message:
        "Target URL must be a public, safe address. Local/private addresses are not permitted.",
    }),
  events: z
    .array(z.enum(["meeting.created", "mom.generated", "policy.updated"]), {
      required_error: "At least one event trigger must be specified.",
    })
    .min(1, "At least one event trigger must be specified."),
  secret: z.string().trim().optional(),
  organizationId: z
    .string({ required_error: "Valid Organization ID is required." })
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Valid Organization ID is required.",
    }),
});

const updateWebhookSchema = z.object({
  targetUrl: z
    .string()
    .trim()
    .min(1, "Target URL cannot be empty.")
    .refine((url) => url.startsWith("http://") || url.startsWith("https://"), {
      message: "Target URL must start with http:// or https://.",
    })
    .refine((url) => isSafeWebhookUrl(url), {
      message:
        "Target URL must be a public, safe address. Local/private addresses are not permitted.",
    })
    .optional(),
  events: z
    .array(z.enum(["meeting.created", "mom.generated", "policy.updated"]))
    .min(1, "At least one event trigger must be specified.")
    .optional(),
  secret: z.string().trim().min(1, "Secret key cannot be empty.").optional(),
  isActive: z.boolean().optional(),
});

// Helper to get authenticated user ID
const getUserId = (req) => {
  const id = req.user?.id || req.user?._id;
  if (!id) throw new UnauthorizedError();
  return id.toString();
};

/**
 * 🟢 Register a new Webhook subscription
 * POST /api/webhooks
 */
export const createWebhook = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    let validated;
    try {
      validated = await createWebhookSchema.parseAsync(req.body);
    } catch (zodErr) {
      return next(zodErr);
    }

    // Authorization check
    const isAuthorized = await hasAdminPermission(
      userId,
      validated.organizationId,
    );
    if (!isAuthorized) {
      throw new ForbiddenError(
        "Forbidden. Only organization owners and admins can configure webhooks.",
      );
    }

    const webhookData = {
      organizationId: validated.organizationId,
      targetUrl: validated.targetUrl,
      events: validated.events,
      isActive: true,
    };

    if (validated.secret) {
      webhookData.secret = validated.secret;
    }

    const webhook = await Webhook.create(webhookData);

    return sendSuccess(
      res,
      {
        webhook: {
          _id: webhook._id,
          organizationId: webhook.organizationId,
          targetUrl: webhook.targetUrl,
          events: webhook.events,
          secret: webhook.secret,
          isActive: webhook.isActive,
        },
      },
      "Webhook registered successfully.",
      201,
    );
  } catch (error) {
    console.error("DEBUG WEBHOOK ERROR:", error);
    next(error);
  }
};

/**
 * 🟢 Get webhook subscriptions for an organization
 * GET /api/webhooks?organizationId=xxx
 */
export const getWebhooks = async (req, res, next) => {
  try {
    const { organizationId } = req.query;
    const userId = getUserId(req);

    if (!organizationId || !mongoose.Types.ObjectId.isValid(organizationId)) {
      throw new ValidationError("Valid Organization ID is required.");
    }

    // Authorization check
    const isAuthorized = await hasAdminPermission(userId, organizationId);
    if (!isAuthorized) {
      throw new ForbiddenError(
        "Forbidden. Only organization owners and admins can view webhooks.",
      );
    }

    const webhooks = await Webhook.find({ organizationId }).sort({
      createdAt: -1,
    });

    return sendSuccess(res, { webhooks });
  } catch (error) {
    next(error);
  }
};

/**
 * 🟢 Update webhook subscription details
 * PATCH /api/webhooks/:id
 */
export const updateWebhook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Valid Webhook ID is required.");
    }

    const webhook = await Webhook.findById(id);
    if (!webhook) {
      throw new NotFoundError("Webhook subscription not found.");
    }

    // Authorization check
    const isAuthorized = await hasAdminPermission(
      userId,
      webhook.organizationId,
    );
    if (!isAuthorized) {
      throw new ForbiddenError(
        "Forbidden. Only organization owners and admins can modify webhooks.",
      );
    }

    let validated;
    try {
      validated = await updateWebhookSchema.parseAsync(req.body);
    } catch (zodErr) {
      return next(zodErr);
    }

    if (validated.targetUrl !== undefined) {
      webhook.targetUrl = validated.targetUrl;
    }
    if (validated.events !== undefined) {
      webhook.events = validated.events;
    }
    if (validated.secret !== undefined) {
      webhook.secret = validated.secret;
    }
    if (validated.isActive !== undefined) {
      webhook.isActive = validated.isActive;
    }

    await webhook.save();

    return sendSuccess(res, { webhook }, "Webhook updated successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * 🟢 Delete webhook subscription
 * DELETE /api/webhooks/:id
 */
export const deleteWebhook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Valid Webhook ID is required.");
    }

    const webhook = await Webhook.findById(id);
    if (!webhook) {
      throw new NotFoundError("Webhook subscription not found.");
    }

    // Authorization check
    const isAuthorized = await hasAdminPermission(
      userId,
      webhook.organizationId,
    );
    if (!isAuthorized) {
      throw new ForbiddenError(
        "Forbidden. Only organization owners and admins can delete webhooks.",
      );
    }

    await webhook.deleteOne();

    return sendSuccess(res, null, "Webhook deleted successfully.");
  } catch (error) {
    next(error);
  }
};

const getDeliveriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["success", "failed", "dlq"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * 🟢 Get delivery audit logs for a specific webhook subscription
 * GET /api/webhooks/:id/deliveries?page=1&limit=20&status=failed&startDate=...&endDate=...
 */
export const getWebhookDeliveries = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError("Valid Webhook ID is required.");
    }

    const webhook = await Webhook.findById(id);
    if (!webhook) {
      throw new NotFoundError("Webhook subscription not found.");
    }

    // Authorization check
    const isAuthorized = await hasAdminPermission(
      userId,
      webhook.organizationId,
    );
    if (!isAuthorized) {
      throw new ForbiddenError(
        "Forbidden. Only organization owners and admins can view webhook delivery logs.",
      );
    }

    const { page, limit, status, startDate, endDate } =
      getDeliveriesQuerySchema.parse(req.query);

    // Build typed query object avoiding taint flags for static analysis (CodeQL)
    const cleanWebhookId = new mongoose.Types.ObjectId(id);
    const query = { webhookId: cleanWebhookId };

    if (status) {
      query.status = String(status);
    }

    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate && !isNaN(Date.parse(startDate))) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate && !isNaN(Date.parse(endDate))) {
        dateFilter.$lte = new Date(endDate);
      }
      if (Object.keys(dateFilter).length > 0) {
        query.createdAt = dateFilter;
      }
    }

    const total = await WebhookDelivery.countDocuments(query);
    const deliveries = await WebhookDelivery.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return sendSuccess(res, {
      deliveries,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 🟢 Manually redeliver a past webhook delivery payload
 * POST /api/webhooks/deliveries/:deliveryId/redeliver
 */
export const redeliverWebhookPayload = async (req, res, next) => {
  try {
    const { deliveryId } = req.params;
    const userId = getUserId(req);

    if (!deliveryId || !mongoose.Types.ObjectId.isValid(deliveryId)) {
      throw new ValidationError("Valid Webhook Delivery ID is required.");
    }

    const deliveryRecord = await WebhookDelivery.findById(deliveryId);
    if (!deliveryRecord) {
      throw new NotFoundError("Webhook delivery log record not found.");
    }

    // Authorization check
    const isAuthorized = await hasAdminPermission(
      userId,
      deliveryRecord.organizationId,
    );
    if (!isAuthorized) {
      throw new ForbiddenError(
        "Forbidden. Only organization owners and admins can trigger webhook redeliveries.",
      );
    }

    const newDelivery = await redeliverWebhookDelivery(deliveryId);

    if (!newDelivery) {
      throw new ValidationError(
        "Redelivery skipped: the target webhook is inactive or paused.",
      );
    }

    return sendSuccess(
      res,
      { delivery: newDelivery },
      "Webhook payload redelivered successfully.",
    );
  } catch (error) {
    next(error);
  }
};
