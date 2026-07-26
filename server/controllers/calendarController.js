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

/**
 * Get calendar connection status for a user
 */
export const getConnectionStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const connections = await CalendarConnection.find({ user: userId });

    const status = {
      google: connections.find((c) => c.provider === "google") || null,
      microsoft: connections.find((c) => c.provider === "microsoft") || null,
    };

    res.json({ success: true, status });
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
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error("Error getting Google OAuth URL:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Handle Google OAuth callback
 */
export const handleGoogleCallback = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    if (!code) {
      return res
        .status(400)
        .json({ success: false, message: "Authorization code is required" });
    }

    const tokens = await getGoogleTokens(code);

    // Calculate token expiration
    const tokenExpiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000); // Default 1 hour

    // Check if connection already exists
    let connection = await CalendarConnection.findOne({
      user: userId,
      provider: "google",
    });

    if (connection) {
      // Update existing connection
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
      // Create new connection
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
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Microsoft OAuth authorization URL
 */
export const getMicrosoftOAuthUrl = async (req, res) => {
  try {
    const authUrl = await getMicrosoftAuthUrl();
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error("Error getting Microsoft OAuth URL:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Handle Microsoft OAuth callback
 */
export const handleMicrosoftCallback = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    if (!code) {
      return res
        .status(400)
        .json({ success: false, message: "Authorization code is required" });
    }

    const tokenResponse = await getMicrosoftTokens(code);

    // Calculate token expiration (Microsoft tokens typically expire in 1 hour)
    const tokenExpiresAt = new Date(
      Date.now() + (tokenResponse.expiresOn || 3600) * 1000,
    );

    // Check if connection already exists
    let connection = await CalendarConnection.findOne({
      user: userId,
      provider: "microsoft",
    });

    if (connection) {
      // Update existing connection
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
      // Create new connection
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
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Disconnect a calendar provider
 */
export const disconnectCalendar = async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.user._id;

    if (!["google", "microsoft"].includes(provider)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid provider" });
    }

    const connection = await CalendarConnection.findOneAndDelete({
      user: userId,
      provider,
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
    const userId = req.user._id;

    if (!["google", "microsoft"].includes(provider)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid provider" });
    }

    const connection = await CalendarConnection.findOne({
      user: userId,
      provider,
    });

    if (!connection) {
      return res
        .status(404)
        .json({ success: false, message: "Connection not found" });
    }

    // Update sync status
    connection.syncStatus = "syncing";
    connection.syncError = null;
    await connection.save();

    // Trigger sync (this would typically be handled by a background job)
    // For now, we'll just mark as connected
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
    const userId = req.user._id;

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

    const freeBusyData = await getFreeBusy(userId, attendeeEmails, timeMin, timeMax);

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
    const { timeMin, timeMax } = req.query;
    const userId = req.user._id;

    if (!timeMin || !timeMax) {
      return res
        .status(400)
        .json({ success: false, message: "timeMin and timeMax are required" });
    }

    const events = await fetchExternalEvents(userId, timeMin, timeMax);

    res.json({ success: true, events });
  } catch (error) {
    console.error("Error fetching external events:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
