// server/routes/githubIntegrationRoutes.js
/**
 * GitHub Integration Express Routes
 *
 * Provides endpoints for GitHub OAuth flow and integration status mounted at `/api/github`.
 */

import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireOrganizationParamMatch } from "../middleware/rbac.js";
import {
  initiateOAuth,
  handleCallback,
  getStatus,
  disconnect,
  updateRepository,
  syncActionItem,
  getWebhookEvents,
  getRepositories,
} from "../controllers/githubIntegrationController.js";

const router = express.Router();

// Middleware to normalize organizationId from path, query, body, or req.user fallback
const normalizeOrgId = (req, res, next) => {
  if (!req.params.organizationId) {
    req.params.organizationId =
      req.query.organizationId ||
      req.body.organizationId ||
      req.user?.organization?.toString() ||
      "";
  }
  next();
};

// Public callback (GitHub redirects here; state signature is validated internally)
router.get("/oauth_redirect", handleCallback);

// All other routes require user authentication
router.use(userAuth);

// OAuth Flow Initiation (aliased to support both /auth and /connect)
router.get("/auth", initiateOAuth);
router.get("/connect", initiateOAuth);

// Scoped status checking
router.get(
  "/status/:organizationId",
  normalizeOrgId,
  requireOrganizationParamMatch("organizationId"),
  getStatus,
);
router.get(
  "/status",
  normalizeOrgId,
  requireOrganizationParamMatch("organizationId"),
  getStatus,
);

// Webhook Event Logs (Issue #2237)
router.get(
  "/webhook-events/:organizationId",
  normalizeOrgId,
  requireOrganizationParamMatch("organizationId"),
  getWebhookEvents,
);
router.get(
  "/webhook-events",
  normalizeOrgId,
  requireOrganizationParamMatch("organizationId"),
  getWebhookEvents,
);

// Scoped disconnection
router.delete(
  "/disconnect/:organizationId",
  normalizeOrgId,
  requireOrganizationParamMatch("organizationId"),
  disconnect,
);
router.post(
  "/disconnect",
  normalizeOrgId,
  requireOrganizationParamMatch("organizationId"),
  disconnect,
);

// Scoped repository configuration
router.post(
  "/repository/:organizationId",
  normalizeOrgId,
  requireOrganizationParamMatch("organizationId"),
  updateRepository,
);
router.post(
  "/repository",
  normalizeOrgId,
  requireOrganizationParamMatch("organizationId"),
  updateRepository,
);

// Repository listing
router.get(
  "/repos/:organizationId",
  normalizeOrgId,
  requireOrganizationParamMatch("organizationId"),
  getRepositories,
);
router.get(
  "/repos",
  normalizeOrgId,
  requireOrganizationParamMatch("organizationId"),
  getRepositories,
);

// Action Item manual sync trigger
router.post("/sync", syncActionItem);

export default router;
