import express from "express";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import { requireOrgMembership, requirePermission } from "../middleware/rbac.js";
import {
  createWebhook,
  getWebhooks,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  redeliverWebhookPayload,
} from "../controllers/webhookController.js";

const router = express.Router();

// Apply global rate limiting to webhook routes
router.use(apiLimiter);

// Apply authentication middleware to all routes
router.use(userAuth);

// Create Webhook Subscription
router.post(
  "/",
  writeLimiter,
  requireOrgMembership,
  requirePermission("settings", "edit"),
  createWebhook,
);

// Get Webhooks for an Organization
router.get(
  "/",
  requireOrgMembership,
  requirePermission("settings", "view"),
  getWebhooks,
);

// Update Webhook Subscription
router.patch(
  "/:id",
  writeLimiter,
  requireOrgMembership,
  requirePermission("settings", "edit"),
  updateWebhook,
);

// Delete Webhook Subscription
router.delete(
  "/:id",
  writeLimiter,
  requireOrgMembership,
  requirePermission("settings", "edit"),
  deleteWebhook,
);

// Get Webhook Delivery Logs
router.get(
  "/:id/deliveries",
  requireOrgMembership,
  requirePermission("settings", "view"),
  getWebhookDeliveries,
);

// Redeliver Webhook Payload
router.post(
  "/deliveries/:deliveryId/redeliver",
  writeLimiter,
  requireOrgMembership,
  requirePermission("settings", "edit"),
  redeliverWebhookPayload,
);

export default router;
