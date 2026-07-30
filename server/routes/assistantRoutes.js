import express from "express";
import {
  createSession,
  getSession,
  deleteSession,
  listSessions,
  processMessage,
  setPinnedContext,
  clearPinnedContext,
} from "../services/ragAssistantService.js";
import userAuth from "../middleware/userAuth.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

router.use(userAuth);

const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each user to 10 messages per minute
  message: { error: "Too many messages sent. Please try again later." },
});

// Create a new session
router.post("/sessions", async (req, res) => {
  try {
    const session = await createSession(req.user.organization, req.user._id);
    res.status(201).json(session);
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

// List all sessions for the user
router.get("/sessions", async (req, res) => {
  try {
    const sessions = await listSessions(req.user._id);
    res.json(sessions);
  } catch (error) {
    console.error("Error fetching sessions:", error);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// Get a specific session
router.get("/sessions/:id", async (req, res) => {
  try {
    const session = await getSession(req.params.id, req.user._id);
    res.json(session);
  } catch (error) {
    console.error("Error fetching session:", error);
    res.status(404).json({ error: "Session not found" });
  }
});

// Delete a session
router.delete("/sessions/:id", async (req, res) => {
  try {
    await deleteSession(req.params.id, req.user._id);
    res.status(204).end();
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

// Pin or replace pinned context for a session
router.put("/sessions/:id/pinned-context", async (req, res) => {
  try {
    const { type, refId, title } = req.body || {};
    if (!type || !refId) {
      return res
        .status(400)
        .json({ error: "type and refId are required to pin context." });
    }

    const session = await setPinnedContext(
      req.params.id,
      req.user._id,
      req.user.organization,
      { type, refId, title },
    );
    res.json({
      pinnedContext: session.pinnedContext,
      sessionId: session._id,
    });
  } catch (error) {
    console.error("Error pinning context:", error);
    const status =
      error.message?.includes("not found") ||
      error.message?.includes("not accessible")
        ? 403
        : error.message?.includes("Invalid")
          ? 400
          : 500;
    res.status(status).json({
      error: error.message || "Failed to pin context",
    });
  }
});

// Remove pinned context
router.delete("/sessions/:id/pinned-context", async (req, res) => {
  try {
    const session = await clearPinnedContext(req.params.id, req.user._id);
    res.json({
      pinnedContext: session.pinnedContext,
      sessionId: session._id,
    });
  } catch (error) {
    console.error("Error clearing pinned context:", error);
    res.status(error.message === "Session not found" ? 404 : 500).json({
      error: error.message || "Failed to clear pinned context",
    });
  }
});

// Send a message
router.post("/sessions/:id/message", messageLimiter, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Message content is required" });
    }

    const sessionId = req.params.id;
    const io = req.app.get("io");

    processMessage(sessionId, req.user._id, content, io).catch((err) => {
      console.error("Error processing message:", err);
      io.emit("assistant_error", {
        sessionId,
        error: "Failed to process message.",
      });
    });

    res.status(202).json({ status: "Processing" });
  } catch (error) {
    console.error("Error in message route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
