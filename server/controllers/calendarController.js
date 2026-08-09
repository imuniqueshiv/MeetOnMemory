import CalendarConnection from "../models/calendarConnectionModel.js";
import {
  getGoogleAuthUrl,
  getGoogleTokens,
  getMicrosoftAuthUrl,
  getMicrosoftTokens,
  encryptToken,
  getFreeBusy,
  fetchExternalEvents,
} from "../services/calendarService.js";
import { triggerManualSync } from "../jobs/calendarSyncJob.js";
import { buildCalendarOAuthClientRedirect } from "../utils/calendarOAuthRedirect.js";

const getUserId = (req) => {
  const id = req.user?._id || req.user?.id;
  if (!id) throw new Error("Unauthorized: User ID missing");
  return id;
};

/**
 * Get calendar connection status for a user
 */
export const getConnectionStatus = async (req, res) => {
  try {
    const userId = getUserId(req);
    const connections = await CalendarConnection.find({ user: userId });

    const status = {
      google: connections.find((c) => c.provider === "google") || null,
      microsoft:
        connections.find((c) =>
          ["microsoft", "outlook"].includes(c.provider),
        ) || null,
    };

    const integrations = connections.map((c) => ({
      provider: c.provider,
      syncStatus: c.syncStatus,
      syncEnabled: c.syncStatus === "connected",
      lastSyncedAt: c.lastSyncAt || c.updatedAt,
      externalCalendarId: c.providerData?.calendarId || "primary",
    }));

    res.json({ success: true, status, integrations });
  } catch (error) {
    console.error("Error getting connection status:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Google OAuth authorization URL
 */
export const getGoogleOAuthUrl = async (req, res) => {
  try {
    const authUrl = getGoogleAuthUrl();
    res.json({ success: true, authUrl, url: authUrl });
  } catch (error) {
    console.error("Error getting Google OAuth URL:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Handle Google OAuth callback
 */
export const handleGoogleCallback = async (req, res) => {
  const isGetRequest = req.method === "GET";
  try {
    const code = req.body?.code || req.query?.code;
    const userId = req.user?._id || req.user?.id || req.query?.state;

    if (!code || !userId) {
      if (isGetRequest) {
        return res.redirect(
          buildCalendarOAuthClientRedirect(
            "/settings?error=google_sync_failed",
          ),
        );
      }
      return res.status(400).json({
        success: false,
        message: "Authorization code and user state are required",
      });
    }

    const tokens = await getGoogleTokens(code);

    const tokenExpiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    let connection = await CalendarConnection.findOne({
      user: userId,
      provider: "google",
    });

    if (connection) {
      connection.accessToken = encryptToken(tokens.access_token);
      connection.refreshToken = tokens.refresh_token
        ? encryptToken(tokens.refresh_token)
        : connection.refreshToken;
      connection.tokenExpiresAt = tokenExpiresAt;
      connection.syncStatus = "connected";
      connection.syncError = null;
      connection.lastSyncAt = new Date();
      await connection.save();
    } else {
      connection = await CalendarConnection.create({
        user: userId,
        provider: "google",
        accessToken: encryptToken(tokens.access_token),
        refreshToken: tokens.refresh_token
          ? encryptToken(tokens.refresh_token)
          : null,
        tokenExpiresAt,
        syncStatus: "connected",
        lastSyncAt: new Date(),
      });
    }

    if (isGetRequest) {
      return res.redirect(
        buildCalendarOAuthClientRedirect("/settings?sync=success"),
      );
    }

    res.json({
      success: true,
      message: "Google Calendar connected successfully",
      connection: {
        provider: connection.provider,
        syncStatus: connection.syncStatus,
        lastSyncAt: connection.lastSyncAt,
      },
    });
  } catch (error) {
    console.error("Error handling Google callback:", error.message);
    if (isGetRequest) {
      return res.redirect(
        buildCalendarOAuthClientRedirect("/settings?error=google_sync_failed"),
      );
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Microsoft OAuth authorization URL
 */
export const getMicrosoftOAuthUrl = async (req, res) => {
  try {
    const authUrl = await getMicrosoftAuthUrl();
    res.json({ success: true, authUrl, url: authUrl });
  } catch (error) {
    console.error("Error getting Microsoft OAuth URL:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Handle Microsoft OAuth callback
 */
export const handleMicrosoftCallback = async (req, res) => {
  const isGetRequest = req.method === "GET";
  try {
    const code = req.body?.code || req.query?.code;
    const userId = req.user?._id || req.user?.id || req.query?.state;

    if (!code || !userId) {
      if (isGetRequest) {
        return res.redirect(
          buildCalendarOAuthClientRedirect(
            "/settings?error=outlook_sync_failed",
          ),
        );
      }
      return res.status(400).json({
        success: false,
        message: "Authorization code and user state are required",
      });
    }

    const tokenResponse = await getMicrosoftTokens(code);

    const tokenExpiresAt = new Date(
      Date.now() + (tokenResponse.expiresOn || 3600) * 1000,
    );

    let connection = await CalendarConnection.findOne({
      user: userId,
      provider: { $in: ["microsoft", "outlook"] },
    });

    if (connection) {
      connection.accessToken = encryptToken(tokenResponse.accessToken);
      connection.refreshToken = tokenResponse.refreshToken
        ? encryptToken(tokenResponse.refreshToken)
        : connection.refreshToken;
      connection.tokenExpiresAt = tokenExpiresAt;
      connection.syncStatus = "connected";
      connection.syncError = null;
      connection.lastSyncAt = new Date();
      connection.providerData = {
        email: tokenResponse.account?.username || null,
      };
      await connection.save();
    } else {
      connection = await CalendarConnection.create({
        user: userId,
        provider: "microsoft",
        accessToken: encryptToken(tokenResponse.accessToken),
        refreshToken: tokenResponse.refreshToken
          ? encryptToken(tokenResponse.refreshToken)
          : null,
        tokenExpiresAt,
        syncStatus: "connected",
        lastSyncAt: new Date(),
        providerData: {
          email: tokenResponse.account?.username || null,
        },
      });
    }

    if (isGetRequest) {
      return res.redirect(
        buildCalendarOAuthClientRedirect("/settings?sync=success"),
      );
    }

    res.json({
      success: true,
      message: "Microsoft Calendar connected successfully",
      connection: {
        provider: connection.provider,
        syncStatus: connection.syncStatus,
        lastSyncAt: connection.lastSyncAt,
      },
    });
  } catch (error) {
    console.error("Error handling Microsoft callback:", error.message);
    if (isGetRequest) {
      return res.redirect(
        buildCalendarOAuthClientRedirect("/settings?error=outlook_sync_failed"),
      );
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Disconnect a calendar provider
 */
export const disconnectCalendar = async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.user.id || req.user._id;

    if (!["google", "microsoft", "outlook"].includes(provider)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid provider" });
    }

    const providersToMatch =
      provider === "google" ? ["google"] : ["microsoft", "outlook"];

    const connection = await CalendarConnection.findOneAndDelete({
      user: userId,
      provider: { $in: providersToMatch },
    });

    if (!connection) {
      return res
        .status(404)
        .json({ success: false, message: "Connection not found" });
    }

    res.json({
      success: true,
      message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Calendar disconnected successfully`,
    });
  } catch (error) {
    console.error("Error disconnecting calendar:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Manual resync trigger
 */
export const resyncCalendar = async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.user.id || req.user._id;

    if (!["google", "microsoft", "outlook"].includes(provider)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid provider" });
    }

    const providersToMatch =
      provider === "google" ? ["google"] : ["microsoft", "outlook"];

    const connection = await CalendarConnection.findOne({
      user: userId,
      provider: { $in: providersToMatch },
    });

    if (!connection) {
      return res
        .status(404)
        .json({ success: false, message: "Connection not found" });
    }

    connection.syncStatus = "syncing";
    connection.syncError = null;
    await connection.save();

    const providerKey = provider === "google" ? "google" : "microsoft";
    await triggerManualSync(userId, providerKey);

    connection.syncStatus = "connected";
    connection.lastSyncAt = new Date();
    await connection.save();

    res.json({
      success: true,
      message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Calendar synced successfully`,
      connection: {
        provider: connection.provider,
        syncStatus: connection.syncStatus,
        lastSyncAt: connection.lastSyncAt,
      },
    });
  } catch (error) {
    console.error("Error resyncing calendar:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get free/busy availability for attendees
 */
export const getFreeBusyAvailability = async (req, res) => {
  try {
    const { attendeeEmails, timeMin, timeMax } = req.body;
    const userId = req.user.id || req.user._id;

    if (!attendeeEmails || !Array.isArray(attendeeEmails)) {
      return res
        .status(400)
        .json({ success: false, message: "attendeeEmails array is required" });
    }

    if (!timeMin || !timeMax) {
      return res
        .status(400)
        .json({ success: false, message: "timeMin and timeMax are required" });
    }

    const freeBusyData = await getFreeBusy(
      userId,
      attendeeEmails,
      timeMin,
      timeMax,
    );

    res.json({ success: true, data: freeBusyData });
  } catch (error) {
    console.error("Error getting free/busy availability:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Fetch external calendar events for calendar view
 */
export const getExternalEvents = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    let { timeMin, timeMax } = req.query;

    if (!timeMin) {
      const minDate = new Date();
      minDate.setDate(minDate.getDate() - 30);
      timeMin = minDate.toISOString();
    }
    if (!timeMax) {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 90);
      timeMax = maxDate.toISOString();
    }

    const rawEvents = await fetchExternalEvents(userId, timeMin, timeMax);

    const formattedEvents = [];
    if (rawEvents.google && Array.isArray(rawEvents.google)) {
      rawEvents.google.forEach((e) => {
        formattedEvents.push({
          id: e.id,
          title: e.summary || "Google Event",
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          location: e.location || "",
          provider: "google",
          isExternal: true,
        });
      });
    }
    if (rawEvents.microsoft && Array.isArray(rawEvents.microsoft)) {
      rawEvents.microsoft.forEach((e) => {
        formattedEvents.push({
          id: e.id,
          title: e.subject || "Outlook Event",
          start: e.start?.dateTime ? e.start.dateTime + "Z" : e.start,
          end: e.end?.dateTime ? e.end.dateTime + "Z" : e.end,
          location: e.location?.displayName || "",
          provider: "outlook",
          isExternal: true,
        });
      });
    }

    res.json({ success: true, events: formattedEvents, rawEvents });
  } catch (error) {
    console.error("Error fetching external events:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
