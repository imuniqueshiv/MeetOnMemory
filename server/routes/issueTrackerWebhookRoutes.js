import express from "express";
import {
  handleJiraWebhook,
  handleLinearWebhook,
  getIncomingWebhookLogs,
} from "../controllers/issueTrackerWebhookController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

// Public webhook endpoints (no auth — verified via signature)
router.post("/jira", handleJiraWebhook);
router.post("/linear", handleLinearWebhook);

// Authenticated endpoint: fetch incoming webhook event logs for admin UI
router.get("/:provider/logs", userAuth, getIncomingWebhookLogs);

export default router;
