import crypto from "crypto";
import { google } from "googleapis";
import axios from "axios";
import cron from "node-cron";
import CalendarIntegration from "../models/calendarIntegrationModel.js";
import Meeting from "../models/meetingModel.js"; // eslint-disable-line no-unused-vars

// Encryption setup
const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY || "12345678901234567890123456789012"; // 32 bytes

const encrypt = (text) => {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY),
    iv,
  );
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
};

const decrypt = (encryptedData) => {
  if (!encryptedData) return encryptedData;
  const parts = encryptedData.split(":");
  if (parts.length !== 3) return encryptedData; // not encrypted or wrong format
  const [ivHex, encryptedText, authTagHex] = parts;
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};

// Google OAuth client
export const getGoogleOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ||
      "http://localhost:4000/api/calendar/google/callback",
  );
};

// --- Calendar Sync Operations ---

const getGoogleCalendarClient = (accessToken, refreshToken) => {
  const oAuth2Client = getGoogleOAuthClient();
  oAuth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.calendar({ version: "v3", auth: oAuth2Client });
};

export const syncMeetingToGoogle = async (integration, meeting) => {
  try {
    const accessToken = decrypt(integration.accessToken);
    const refreshToken = decrypt(integration.refreshToken);
    const calendar = getGoogleCalendarClient(accessToken, refreshToken);

    const event = {
      summary: meeting.title,
      description: meeting.description || "",
      start: {
        dateTime: meeting.date.toISOString(),
        timeZone: "UTC", // Simplify
      },
      end: {
        dateTime: new Date(
          meeting.date.getTime() + (meeting.duration || 60) * 60000,
        ).toISOString(),
        timeZone: "UTC",
      },
      location: meeting.venue || meeting.location || "",
    };

    const existingRef = meeting.externalCalendarRefs.find(
      (r) => r.provider === "google",
    );
    if (existingRef) {
      await calendar.events.update({
        calendarId: integration.externalCalendarId || "primary",
        eventId: existingRef.eventId,
        requestBody: event,
      });
      return { provider: "google", eventId: existingRef.eventId };
    } else {
      const res = await calendar.events.insert({
        calendarId: integration.externalCalendarId || "primary",
        requestBody: event,
      });
      return { provider: "google", eventId: res.data.id };
    }
  } catch (err) {
    console.error("Google sync error:", err.message);
    throw err;
  }
};

export const deleteGoogleMeeting = async (integration, eventId) => {
  try {
    const accessToken = decrypt(integration.accessToken);
    const refreshToken = decrypt(integration.refreshToken);
    const calendar = getGoogleCalendarClient(accessToken, refreshToken);
    await calendar.events.delete({
      calendarId: integration.externalCalendarId || "primary",
      eventId,
    });
  } catch (err) {
    console.error("Google delete error:", err.message);
  }
};

export const syncMeetingToOutlook = async (integration, meeting) => {
  try {
    const accessToken = decrypt(integration.accessToken);
    const event = {
      subject: meeting.title,
      body: { contentType: "Text", content: meeting.description || "" },
      start: { dateTime: meeting.date.toISOString(), timeZone: "UTC" },
      end: {
        dateTime: new Date(
          meeting.date.getTime() + (meeting.duration || 60) * 60000,
        ).toISOString(),
        timeZone: "UTC",
      },
      location: { displayName: meeting.venue || meeting.location || "" },
    };

    const existingRef = meeting.externalCalendarRefs.find(
      (r) => r.provider === "outlook",
    );
    let res;
    if (existingRef) {
      res = await axios.patch(
        `https://graph.microsoft.com/v1.0/me/events/${existingRef.eventId}`,
        event,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      return { provider: "outlook", eventId: existingRef.eventId };
    } else {
      res = await axios.post(
        "https://graph.microsoft.com/v1.0/me/events",
        event,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      return { provider: "outlook", eventId: res.data.id };
    }
  } catch (err) {
    console.error("Outlook sync error:", err.message);
    throw err;
  }
};

export const deleteOutlookMeeting = async (integration, eventId) => {
  try {
    const accessToken = decrypt(integration.accessToken);
    await axios.delete(
      `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
  } catch (err) {
    console.error("Outlook delete error:", err.message);
  }
};

export const pushMeetingToIntegrations = async (userId, meeting) => {
  const integrations = await CalendarIntegration.find({
    userId,
    syncEnabled: true,
  });
  const newRefs = [];
  for (const integration of integrations) {
    try {
      if (integration.provider === "google") {
        const ref = await syncMeetingToGoogle(integration, meeting);
        if (ref) newRefs.push(ref);
      } else if (integration.provider === "outlook") {
        const ref = await syncMeetingToOutlook(integration, meeting);
        if (ref) newRefs.push(ref);
      }
      integration.lastSyncedAt = new Date();
      await integration.save();
    } catch (_err) {
      console.error(`Failed to push to ${integration.provider}`);
    }
  }

  if (newRefs.length > 0) {
    const combinedRefs = [...meeting.externalCalendarRefs];
    newRefs.forEach((nr) => {
      if (!combinedRefs.find((r) => r.provider === nr.provider)) {
        combinedRefs.push(nr);
      }
    });
    meeting.externalCalendarRefs = combinedRefs;
    await meeting.save();
  }
};

export const deleteMeetingFromIntegrations = async (
  userId,
  externalCalendarRefs,
) => {
  if (!externalCalendarRefs || externalCalendarRefs.length === 0) return;
  const integrations = await CalendarIntegration.find({
    userId,
    syncEnabled: true,
  });

  for (const integration of integrations) {
    const ref = externalCalendarRefs.find(
      (r) => r.provider === integration.provider,
    );
    if (ref) {
      if (integration.provider === "google") {
        await deleteGoogleMeeting(integration, ref.eventId);
      } else if (integration.provider === "outlook") {
        await deleteOutlookMeeting(integration, ref.eventId);
      }
    }
  }
};

export const suggestFreeSlot = async (
  userId,
  targetDateIso,
  durationMinutes = 30,
) => {
  try {
    const integrations = await CalendarIntegration.find({
      userId,
      syncEnabled: true,
    });

    let suggestedDate = new Date(targetDateIso);
    if (isNaN(suggestedDate.getTime())) {
      suggestedDate = new Date();
      suggestedDate.setDate(suggestedDate.getDate() + 1); // tomorrow as fallback
      suggestedDate.setHours(14, 0, 0, 0); // 2 PM
    }

    const googleIntegration = integrations.find((i) => i.provider === "google");

    if (googleIntegration) {
      const accessToken = decrypt(googleIntegration.accessToken);
      const refreshToken = decrypt(googleIntegration.refreshToken);
      const calendar = getGoogleCalendarClient(accessToken, refreshToken);

      const timeMin = new Date(suggestedDate);
      timeMin.setHours(0, 0, 0, 0);

      const timeMax = new Date(suggestedDate);
      timeMax.setDate(timeMax.getDate() + 1);
      timeMax.setHours(23, 59, 59, 999);

      const calendarId = googleIntegration.externalCalendarId || "primary";

      const res = await calendar.freebusy.query({
        requestBody: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          timeZone: "UTC",
          items: [{ id: calendarId }],
        },
      });

      const busySlots = res.data.calendars[calendarId].busy || [];

      let currentTry = new Date(suggestedDate);

      // Look for a slot within the next 24 tries (12 hours)
      for (let i = 0; i < 24; i++) {
        const tryEnd = new Date(currentTry.getTime() + durationMinutes * 60000);

        const isBusy = busySlots.some((slot) => {
          const busyStart = new Date(slot.start);
          const busyEnd = new Date(slot.end);
          return currentTry < busyEnd && tryEnd > busyStart;
        });

        if (!isBusy) {
          suggestedDate = currentTry;
          break;
        }
        currentTry = new Date(currentTry.getTime() + 30 * 60000); // add 30 mins
      }
    }

    return suggestedDate.toISOString();
  } catch (err) {
    console.error("Error finding free slot:", err.message);
    return targetDateIso;
  }
};

// --- Refresh tokens & Cron ---

const refreshGoogleToken = async (integration) => {
  try {
    const oauth2Client = getGoogleOAuthClient();
    oauth2Client.setCredentials({
      refresh_token: decrypt(integration.refreshToken),
    });
    const { credentials } = await oauth2Client.refreshAccessToken();
    integration.accessToken = encrypt(credentials.access_token);
    integration.expiresAt = new Date(credentials.expiry_date);
    await integration.save();
  } catch (err) {
    console.error("Failed to refresh Google token", err.message);
    integration.syncEnabled = false;
    await integration.save();
  }
};

const refreshOutlookToken = async (integration) => {
  try {
    const params = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      client_secret: process.env.MS_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: decrypt(integration.refreshToken),
    });
    const res = await axios.post(
      `https://login.microsoftonline.com/${process.env.MS_TENANT_ID || "common"}/oauth2/v2.0/token`,
      params,
    );
    integration.accessToken = encrypt(res.data.access_token);
    if (res.data.refresh_token) {
      integration.refreshToken = encrypt(res.data.refresh_token);
    }
    integration.expiresAt = new Date(Date.now() + res.data.expires_in * 1000);
    await integration.save();
  } catch (err) {
    console.error("Failed to refresh Outlook token", err.message);
    integration.syncEnabled = false;
    await integration.save();
  }
};

// Cron job to run every 15 minutes to refresh expiring tokens
export const initCalendarSyncCron = () => {
  cron.schedule("*/15 * * * *", async () => {
    console.log("Running Calendar Sync Reconciliation Cron");
    const expiringTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    const integrations = await CalendarIntegration.find({
      syncEnabled: true,
      expiresAt: { $lte: expiringTime },
    });

    for (const integration of integrations) {
      if (integration.provider === "google" && integration.refreshToken) {
        await refreshGoogleToken(integration);
      } else if (
        integration.provider === "outlook" &&
        integration.refreshToken
      ) {
        await refreshOutlookToken(integration);
      }
    }
  });
};

export { encrypt, decrypt };
