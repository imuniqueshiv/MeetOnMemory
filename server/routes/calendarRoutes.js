import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  getGoogleOAuthClient,
  encrypt,
  decrypt,
  suggestFreeSlot,
} from "../services/calendarSyncService.js";
import CalendarIntegration from "../models/calendarIntegrationModel.js";
import axios from "axios";
import mongoose from "mongoose";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.use(apiLimiter);

router.get("/status", userAuth, async (req, res) => {
  try {
    const integrations = await CalendarIntegration.find({
      userId: req.user.id || req.user._id,
    });
    res.json({
      success: true,
      integrations: integrations.map((i) => ({
        provider: i.provider,
        syncEnabled: i.syncEnabled,
        lastSyncedAt: i.lastSyncedAt,
        externalCalendarId: i.externalCalendarId,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post(
  "/disconnect/:provider",
  userAuth,
  writeLimiter,
  async (req, res) => {
    try {
      const { provider } = req.params;
      await CalendarIntegration.findOneAndDelete({
        userId: req.user.id || req.user._id,
        provider,
      });
      res.json({ success: true, message: "Disconnected successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

router.post("/suggest-slot", userAuth, async (req, res) => {
  try {
    const { targetDateIso, durationMinutes } = req.body;
    if (!targetDateIso) {
      return res
        .status(400)
        .json({ success: false, message: "targetDateIso is required" });
    }
    const suggestedSlot = await suggestFreeSlot(
      req.user.id || req.user._id,
      targetDateIso,
      durationMinutes,
    );
    res.json({ success: true, suggestedSlot });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- GOOGLE OAUTH ---

router.get("/google/connect", userAuth, (req, res) => {
  const oauth2Client = getGoogleOAuthClient();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state: req.user.id || req.user._id, // pass userId in state
    prompt: "consent",
  });
  res.json({ success: true, url: authUrl });
});

router.get("/google/callback", async (req, res) => {
  try {
    let { code, state: userId } = req.query;
    if (!code || !userId) throw new Error("Missing code or state");

    userId = String(userId);
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid state/userId");
    }

    const oauth2Client = getGoogleOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    await CalendarIntegration.findOneAndUpdate(
      { userId, provider: "google" },
      {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt: new Date(tokens.expiry_date),
        syncEnabled: true,
        lastSyncedAt: null,
      },
      { upsert: true, new: true },
    );

    // Redirect to frontend settings page
    res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:5173"}/settings`,
    );
  } catch (error) {
    console.error("Google Callback Error:", error.message);
    res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:5173"}/settings?error=google_sync_failed`,
    );
  }
});

// --- OUTLOOK OAUTH ---

router.get("/outlook/connect", userAuth, (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    response_type: "code",
    redirect_uri:
      process.env.MS_REDIRECT_URI ||
      "http://localhost:4000/api/calendar/outlook/callback",
    scope: "offline_access Calendars.ReadWrite",
    state: req.user.id || req.user._id,
  });
  const url = `https://login.microsoftonline.com/${process.env.MS_TENANT_ID || "common"}/oauth2/v2.0/authorize?${params.toString()}`;
  res.json({ success: true, url });
});

router.get("/outlook/callback", async (req, res) => {
  try {
    let { code, state: userId } = req.query;
    if (!code || !userId) throw new Error("Missing code or state");

    userId = String(userId);
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid state/userId");
    }

    const params = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      client_secret: process.env.MS_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri:
        process.env.MS_REDIRECT_URI ||
        "http://localhost:4000/api/calendar/outlook/callback",
    });

    const tokenRes = await axios.post(
      `https://login.microsoftonline.com/${process.env.MS_TENANT_ID || "common"}/oauth2/v2.0/token`,
      params,
    );

    const data = tokenRes.data;
    await CalendarIntegration.findOneAndUpdate(
      { userId, provider: "outlook" },
      {
        accessToken: encrypt(data.access_token),
        refreshToken: encrypt(data.refresh_token),
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        syncEnabled: true,
        lastSyncedAt: null,
      },
      { upsert: true, new: true },
    );

    res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:5173"}/settings`,
    );
  } catch (error) {
    console.error("Outlook Callback Error:", error.message);
    res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:5173"}/settings?error=outlook_sync_failed`,
    );
  }
});

// --- EXTERNAL EVENTS FETCH ---

router.get("/events", userAuth, async (req, res) => {
  try {
    const integrations = await CalendarIntegration.find({
      userId: req.user.id || req.user._id,
      syncEnabled: true,
    });
    let allEvents = [];

    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30); // fetch from past 30 days
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 90); // to next 90 days

    for (const integration of integrations) {
      if (integration.provider === "google") {
        try {
          const { google } = await import("googleapis");
          const oauth2Client = getGoogleOAuthClient();
          oauth2Client.setCredentials({
            access_token: decrypt(integration.accessToken),
          });
          const calendar = google.calendar({
            version: "v3",
            auth: oauth2Client,
          });
          const eventsRes = await calendar.events.list({
            calendarId: "primary",
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
          });
          const items = eventsRes.data.items.map((e) => ({
            id: e.id,
            provider: "google",
            title: e.summary,
            start: e.start.dateTime || e.start.date,
            end: e.end.dateTime || e.end.date,
            location: e.location,
            isExternal: true,
          }));
          allEvents = [...allEvents, ...items];
        } catch (err) {
          console.error("Google events fetch error:", err.message);
        }
      } else if (integration.provider === "outlook") {
        try {
          const accessToken = decrypt(integration.accessToken);
          const eventsRes = await axios.get(
            `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${timeMin.toISOString()}&endDateTime=${timeMax.toISOString()}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          const items = eventsRes.data.value.map((e) => ({
            id: e.id,
            provider: "outlook",
            title: e.subject,
            start: e.start.dateTime + "Z", // outlook returns naive UTC
            end: e.end.dateTime + "Z",
            location: e.location?.displayName,
            isExternal: true,
          }));
          allEvents = [...allEvents, ...items];
        } catch (err) {
          console.error("Outlook events fetch error:", err.message);
        }
      }
    }

    res.json({ success: true, events: allEvents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
