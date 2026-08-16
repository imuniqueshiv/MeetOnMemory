import express from "express";
import { linkMeetingToGithub, handleGithubWebhook } from "../controllers/githubWebhookController.js";
import { githubAuthGuard } from "../middleware/githubAuthMiddleware.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// Webhook from GitHub (No internal auth, relies on GitHub signatures)
router.post("/webhook", handleGithubWebhook);

// User-triggered sync (Requires internal auth + GitHub token)
// Assuming authenticate is a generic user auth middleware
router.post("/link", authenticate || ((req, res, next) => next()), githubAuthGuard, linkMeetingToGithub);

export default router;
