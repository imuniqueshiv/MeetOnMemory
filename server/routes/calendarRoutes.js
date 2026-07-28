import express from "express";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import {
  getConnectionStatus,
  getGoogleOAuthUrl,
  handleGoogleCallback,
  getMicrosoftOAuthUrl,
  handleMicrosoftCallback,
  disconnectCalendar,
  resyncCalendar,
  getFreeBusyAvailability,
  getExternalEvents,
} from "../controllers/calendarController.js";
import { suggestFreeSlot } from "../services/calendarSyncService.js";

const router = express.Router();

router.use(apiLimiter);

// Status
router.get("/status", userAuth, getConnectionStatus);

// Google OAuth
router.get(
  ["/google/connect", "/google/auth-url"],
  userAuth,
  getGoogleOAuthUrl,
);
router.get("/google/callback", handleGoogleCallback);
router.post("/google/callback", userAuth, handleGoogleCallback);

// Microsoft / Outlook OAuth
router.get(
  [
    "/microsoft/connect",
    "/microsoft/auth-url",
    "/outlook/connect",
    "/outlook/auth-url",
  ],
  userAuth,
  getMicrosoftOAuthUrl,
);
router.get(
  ["/microsoft/callback", "/outlook/callback"],
  handleMicrosoftCallback,
);
router.post(
  ["/microsoft/callback", "/outlook/callback"],
  userAuth,
  handleMicrosoftCallback,
);

// Disconnect
router.post(
  "/disconnect/:provider",
  userAuth,
  writeLimiter,
  disconnectCalendar,
);
router.delete(
  "/:provider/disconnect",
  userAuth,
  writeLimiter,
  disconnectCalendar,
);
router.delete(
  "/disconnect/:provider",
  userAuth,
  writeLimiter,
  disconnectCalendar,
);

// Resync
router.post("/resync/:provider", userAuth, writeLimiter, resyncCalendar);
router.post("/:provider/resync", userAuth, writeLimiter, resyncCalendar);

// Free/Busy & Events
router.post("/freebusy", userAuth, getFreeBusyAvailability);
router.get(["/events", "/external-events"], userAuth, getExternalEvents);

// Suggest Slot
router.post("/suggest-slot", userAuth, async (req, res) => {
  try {
    const { targetDateIso, durationMinutes } = req.body;
    if (!targetDateIso) {
      return res
        .status(400)
        .json({ success: false, message: "targetDateIso is required" });
    }
    const userId = req.user.id || req.user._id;
    const suggestedSlot = await suggestFreeSlot(
      userId,
      targetDateIso,
      durationMinutes,
    );
    res.json({ success: true, suggestedSlot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
