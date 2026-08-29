import ActionItem from "../models/actionItemModel.js";
import IncomingWebhookEventLog from "../models/incomingWebhookEventLogModel.js";
import crypto from "crypto";

/**
 * Helper to verify Linear webhook signature using HMAC-SHA256 and timing-safe comparison.
 * Linear passes the HMAC digest in the `Linear-Signature` header.
 */
export const verifyLinearSignature = (req) => {
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!secret) {
    return {
      isValid: false,
      reason: "LINEAR_WEBHOOK_SECRET is not configured",
    };
  }

  const signature =
    req.headers["linear-signature"] || req.headers["x-linear-signature"];
  if (!signature) {
    return { isValid: false, reason: "Missing Linear signature header" };
  }

  const rawPayload = req.rawBody
    ? req.rawBody
    : typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body);

  const computedHex = crypto
    .createHmac("sha256", secret)
    .update(rawPayload)
    .digest("hex");

  const sigBuf = Buffer.from(String(signature).toLowerCase());
  const compBuf = Buffer.from(computedHex.toLowerCase());

  if (
    sigBuf.length !== compBuf.length ||
    !crypto.timingSafeEqual(sigBuf, compBuf)
  ) {
    return { isValid: false, reason: "Invalid Linear signature" };
  }

  return { isValid: true };
};

/**
 * Helper to verify Jira webhook signature or bearer token authorization.
 * Jira passes authorization tokens or signatures in `authorization` or `x-jira-signature` headers.
 */
export const verifyJiraSignature = (req) => {
  const secret = process.env.JIRA_WEBHOOK_SECRET;
  if (!secret) {
    return { isValid: false, reason: "JIRA_WEBHOOK_SECRET is not configured" };
  }

  const signature =
    req.headers["x-jira-signature"] ||
    req.headers["x-hub-signature"] ||
    req.headers["authorization"] ||
    req.headers["x-atlassian-webhook-secret"];

  if (!signature) {
    return {
      isValid: false,
      reason: "Missing Jira authorization header or signature",
    };
  }

  const rawPayload = req.rawBody
    ? req.rawBody
    : typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body);

  if (signature.startsWith("sha256=")) {
    const signatureHash = signature.slice(7);
    const computedHash = crypto
      .createHmac("sha256", secret)
      .update(rawPayload)
      .digest("hex");

    const sigBuf = Buffer.from(signatureHash.toLowerCase());
    const compBuf = Buffer.from(computedHash.toLowerCase());

    if (
      sigBuf.length !== compBuf.length ||
      !crypto.timingSafeEqual(sigBuf, compBuf)
    ) {
      return { isValid: false, reason: "Invalid Jira HMAC signature" };
    }
  } else {
    const token = signature.replace(/^Bearer\s+/i, "");
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);

    if (
      tokenBuf.length !== secretBuf.length ||
      !crypto.timingSafeEqual(tokenBuf, secretBuf)
    ) {
      return { isValid: false, reason: "Invalid Jira secret token" };
    }
  }

  return { isValid: true };
};

/**
 * Log an incoming webhook event to the database for admin visibility.
 */
const logWebhookEvent = async ({
  organizationId,
  provider,
  eventType,
  action,
  status,
  error,
  processingTimeMs,
  payload,
  issueKey,
}) => {
  try {
    await IncomingWebhookEventLog.create({
      organizationId,
      provider,
      eventType,
      action,
      status,
      error,
      processingTimeMs,
      payload,
      issueKey,
    });
  } catch (logErr) {
    console.error("Failed to log incoming webhook event:", logErr);
  }
};

/**
 * Get the organization ID from an issue tracker integration for the given provider.
 */
const getOrgIdForProvider = async (provider) => {
  try {
    const IssueTrackerIntegration = (await import("../models/issueTrackerIntegrationModel.js")).default;
    const integration = await IssueTrackerIntegration.findOne({ provider });
    return integration?.organization || null;
  } catch {
    return null;
  }
};

/**
 * Handle incoming webhooks from Jira
 */
export const handleJiraWebhook = async (req, res) => {
  const startTime = Date.now();

  try {
    // Verify webhook signature / authorization
    const verification = verifyJiraSignature(req);
    if (!verification.isValid) {
      // Best-effort log for auth failures
      const orgId = await getOrgIdForProvider("jira");
      if (orgId) {
        await logWebhookEvent({
          organizationId: orgId,
          provider: "jira",
          eventType: req.body?.webhookEvent || "unknown",
          action: null,
          status: "failed",
          error: verification.reason,
          processingTimeMs: Date.now() - startTime,
          payload: null,
          issueKey: null,
        });
      }
      return res.status(401).json({
        success: false,
        message: verification.reason,
      });
    }

    const payload = req.body;
    const eventType = payload?.webhookEvent || "unknown";
    const action = payload?.issue?.key || null;

    // Jira webhook payloads usually have `webhookEvent`, `issue`, etc.
    let logStatus = "success";
    let logError = null;

    if (payload && payload.issue && payload.issue.key) {
      const issueKey = payload.issue.key;
      const statusName = payload.issue.fields?.status?.name?.toLowerCase();

      // Simple status mapping
      let newStatus = null;
      if (
        statusName === "done" ||
        statusName === "completed" ||
        statusName === "closed"
      ) {
        newStatus = "completed";
      } else if (statusName === "in progress") {
        newStatus = "in-progress";
      } else if (statusName === "to do" || statusName === "open") {
        newStatus = "open";
      }

      if (newStatus) {
        // Find corresponding ActionItem
        const actionItem = await ActionItem.findOne({
          externalJiraIssueId: issueKey,
        });
        if (actionItem && actionItem.status !== newStatus) {
          actionItem.status = newStatus;
          if (newStatus === "completed") {
            actionItem.completedAt = new Date();
          }
          await actionItem.save();
        }
      }
    } else {
      // No issue payload — log as ignored
      logStatus = "ignored";
      logError = "No issue payload found in webhook event";
    }

    // Resolve org for logging
    const orgId = await getOrgIdForProvider("jira");
    if (orgId) {
      await logWebhookEvent({
        organizationId: orgId,
        provider: "jira",
        eventType,
        action: payload?.issue?.key || null,
        status: logStatus,
        error: logError,
        processingTimeMs: Date.now() - startTime,
        payload: payload ? { webhookEvent: eventType, issueKey: payload.issue?.key } : null,
        issueKey: payload?.issue?.key || null,
      });
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing Jira webhook:", error);

    // Log the failure
    const orgId = await getOrgIdForProvider("jira");
    if (orgId) {
      await logWebhookEvent({
        organizationId: orgId,
        provider: "jira",
        eventType: req.body?.webhookEvent || "unknown",
        action: req.body?.issue?.key || null,
        status: "failed",
        error: error.message || "Internal server error",
        processingTimeMs: Date.now() - startTime,
        payload: null,
        issueKey: req.body?.issue?.key || null,
      });
    }

    return res.status(500).send("Server Error");
  }
};

/**
 * Handle incoming webhooks from Linear
 */
export const handleLinearWebhook = async (req, res) => {
  const startTime = Date.now();

  try {
    // Verify webhook signature using Linear-Signature header
    const verification = verifyLinearSignature(req);
    if (!verification.isValid) {
      const orgId = await getOrgIdForProvider("linear");
      if (orgId) {
        await logWebhookEvent({
          organizationId: orgId,
          provider: "linear",
          eventType: req.body?.type || "unknown",
          action: req.body?.action || null,
          status: "failed",
          error: verification.reason,
          processingTimeMs: Date.now() - startTime,
          payload: null,
          issueKey: null,
        });
      }
      return res.status(401).json({
        success: false,
        message: verification.reason,
      });
    }

    const payload = req.body;
    const eventType = payload?.type || "unknown";
    const action = payload?.action || null;

    let logStatus = "success";
    let logError = null;

    if (payload && payload.action === "update" && payload.type === "Issue") {
      const issueId = payload.data?.id;
      const stateName = payload.data?.state?.name?.toLowerCase();

      // Simple status mapping based on typical Linear states
      let newStatus = null;
      if (
        stateName === "done" ||
        stateName === "completed" ||
        stateName === "canceled"
      ) {
        newStatus = "completed";
      } else if (stateName === "in progress") {
        newStatus = "in-progress";
      } else if (stateName === "todo" || stateName === "backlog") {
        newStatus = "open";
      }

      if (issueId && newStatus) {
        const actionItem = await ActionItem.findOne({
          externalLinearIssueId: issueId,
        });
        if (actionItem && actionItem.status !== newStatus) {
          actionItem.status = newStatus;
          if (newStatus === "completed") {
            actionItem.completedAt = new Date();
          }
          await actionItem.save();
        }
      }
    } else {
      logStatus = "ignored";
      logError = `Unsupported event type: ${eventType} / action: ${action}`;
    }

    const orgId = await getOrgIdForProvider("linear");
    if (orgId) {
      await logWebhookEvent({
        organizationId: orgId,
        provider: "linear",
        eventType,
        action,
        status: logStatus,
        error: logError,
        processingTimeMs: Date.now() - startTime,
        payload: payload
          ? { type: eventType, action, issueId: payload.data?.id }
          : null,
        issueKey: payload?.data?.id || null,
      });
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing Linear webhook:", error);

    const orgId = await getOrgIdForProvider("linear");
    if (orgId) {
      await logWebhookEvent({
        organizationId: orgId,
        provider: "linear",
        eventType: req.body?.type || "unknown",
        action: req.body?.action || null,
        status: "failed",
        error: error.message || "Internal server error",
        processingTimeMs: Date.now() - startTime,
        payload: null,
        issueKey: req.body?.data?.id || null,
      });
    }

    return res.status(500).send("Server Error");
  }
};

/**
 * Get incoming webhook event logs for a provider (Jira or Linear).
 * Used by the admin UI to render the event log panel.
 */
export const getIncomingWebhookLogs = async (req, res) => {
  try {
    const { provider } = req.params;
    const orgId = req.user?.organization;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const statusFilter = req.query.status;

    if (!["jira", "linear"].includes(provider)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid provider" });
    }

    const query = { organizationId: orgId, provider };
    if (statusFilter && ["success", "failed", "ignored"].includes(statusFilter)) {
      query.status = statusFilter;
    }

    const total = await IncomingWebhookEventLog.countDocuments(query);
    const logs = await IncomingWebhookEventLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching incoming webhook logs:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};
