/**
 * Slack Integration Routes
 *
 * GET  /api/slack/install         → Initiate Slack OAuth 2.0 install flow
 * GET  /api/slack/oauth_redirect  → Handle Slack OAuth callback, exchange code for token
 * POST /api/slack/events          → Receive all Slack event payloads and slash commands
 *
 * All POST requests to /events are verified against Slack's Signing Secret
 * via the slackSignatureMiddleware before reaching the controller.
 */

import { Router } from "express";
import {
  slackInstall,
  slackOAuthRedirect,
  handleSlackEvents,
  slackSignatureMiddleware,
} from "../controllers/slackController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership, requirePermission } from "../middleware/rbac.js"; // eslint-disable-line no-unused-vars

const router = Router();

// GET /api/slack/install
// Requires the user to be authenticated so we can derive their organizationId.
// The organizationId is also accepted as a query param for direct deep-link flows.
router.get(
  "/install",
  userAuth,
  requirePermission("settings", "edit"),
  slackInstall,
);

// GET /api/slack/oauth_redirect
// Public route — Slack redirects here after the user approves the OAuth consent.
// No userAuth needed; the organizationId is carried in the `state` query param.
router.get("/oauth_redirect", slackOAuthRedirect);

// POST /api/slack/events
// Public route — Slack POSTs all events (slash commands, event callbacks, URL
// verification) here. Signature verification middleware runs first.
router.post("/events", slackSignatureMiddleware, handleSlackEvents);

export default router;
