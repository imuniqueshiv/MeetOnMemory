import { google } from "googleapis";
import CryptoJS from "crypto-js";
import { ClientSecretCredential } from "@azure/identity"; // eslint-disable-line no-unused-vars
import { Client } from "@microsoft/microsoft-graph-client";
import CalendarConnection from "../models/calendarConnectionModel.js";

// Encryption key from environment (should be a long random string)
const ENCRYPTION_KEY =
  process.env.CALENDAR_ENCRYPTION_KEY || "default-key-change-in-production";

/**
 * Encrypt a token for storage
 */
export const encryptToken = (token) => {
  return CryptoJS.AES.encrypt(token, ENCRYPTION_KEY).toString();
};

/**
 * Decrypt a token from storage
 */
export const decryptToken = (encryptedToken) => {
  if (!encryptedToken) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error("Error decrypting token:", error.message);
    return null;
  }
};

/**
 * Refresh Google access token if expired
 */
const refreshGoogleToken = async (connection) => {
  try {
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    const refreshToken = decryptToken(connection.refreshToken);
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    oAuth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oAuth2Client.refreshAccessToken();

    // Update connection with new tokens
    connection.accessToken = encryptToken(credentials.access_token);
    if (credentials.refresh_token) {
      connection.refreshToken = encryptToken(credentials.refresh_token);
    }
    connection.tokenExpiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : null;
    connection.syncStatus = "connected";
    connection.syncError = null;
    await connection.save();

    return credentials.access_token;
  } catch (error) {
    console.error("Error refreshing Google token:", error.message);
    connection.syncStatus = "needs_reauth";
    connection.syncError = "Token refresh failed";
    await connection.save();
    throw error;
  }
};

/**
 * Get Google OAuth2 client with automatic token refresh
 */
export const getGoogleOAuth2Client = async (connection) => {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  const accessToken = decryptToken(connection.accessToken);
  const refreshToken = decryptToken(connection.refreshToken);

  if (!accessToken) {
    throw new Error("No access token available");
  }

  // Check if token is expired
  if (connection.tokenExpiresAt && new Date() >= connection.tokenExpiresAt) {
    const newAccessToken = await refreshGoogleToken(connection);
    oAuth2Client.setCredentials({ access_token: newAccessToken });
  } else {
    oAuth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  return oAuth2Client;
};

/**
 * Get Microsoft Graph client with automatic token refresh
 */
export const getMicrosoftClient = async (connection) => {
  const accessToken = decryptToken(connection.accessToken);

  if (!accessToken) {
    throw new Error("No access token available");
  }

  // Check if token is expired
  if (connection.tokenExpiresAt && new Date() >= connection.tokenExpiresAt) {
    // Microsoft token refresh would go here
    // For now, mark as needs reauth
    connection.syncStatus = "needs_reauth";
    connection.syncError = "Token expired - needs re-authentication";
    await connection.save();
    throw new Error("Token expired");
  }

  const authProvider = {
    getAccessToken: async () => accessToken,
  };

  return Client.initWithMiddleware({ authProvider });
};

/**
 * Parse meeting date/time to ISO string
 */
const parseMeetingDateTime = (meetingDetails) => {
  let startDateTime = new Date(meetingDetails.date);
  if (meetingDetails.time) {
    const [hours, minutes] = meetingDetails.time.split(":");
    startDateTime.setHours(parseInt(hours, 10));
    startDateTime.setMinutes(parseInt(minutes, 10));
  }
  return startDateTime;
};

/**
 * Create Google Calendar event
 */
export const createGoogleEvent = async (userId, meetingDetails) => {
  try {
    const connection = await CalendarConnection.findOne({
      user: userId,
      provider: "google",
      syncStatus: "connected",
    });

    if (!connection) {
      console.log("No connected Google Calendar found for user");
      return null;
    }

    const oAuth2Client = await getGoogleOAuth2Client(connection);
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    const startDateTime = parseMeetingDateTime(meetingDetails);
    const duration = meetingDetails.duration || 60;
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    const attendees =
      meetingDetails.participants?.map((p) => ({
        email: p.email,
        displayName: p.name,
      })) || [];

    const event = {
      summary: meetingDetails.title,
      location: meetingDetails.location || meetingDetails.venue || "",
      description: meetingDetails.description || "",
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: "UTC",
      },
      attendees: attendees.length > 0 ? attendees : undefined,
    };

    const res = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
    });

    console.log("✅ Google Calendar event created:", res.data.id);

    // Update connection sync status
    connection.lastSyncAt = new Date();
    connection.syncStatus = "connected";
    connection.syncError = null;
    await connection.save();

    return res.data.id;
  } catch (error) {
    console.error("❌ Error creating Google Calendar event:", error.message);

    // Update connection with error
    const connection = await CalendarConnection.findOne({
      user: userId,
      provider: "google",
    });
    if (connection) {
      connection.syncStatus = "error";
      connection.syncError = error.message;
      await connection.save();
    }

    return null;
  }
};

/**
 * Update Google Calendar event
 */
export const updateGoogleEvent = async (userId, meetingDetails, eventId) => {
  try {
    const connection = await CalendarConnection.findOne({
      user: userId,
      provider: "google",
      syncStatus: "connected",
    });

    if (!connection) {
      console.log("No connected Google Calendar found for user");
      return;
    }

    const oAuth2Client = await getGoogleOAuth2Client(connection);
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    const startDateTime = parseMeetingDateTime(meetingDetails);
    const duration = meetingDetails.duration || 60;
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    const attendees =
      meetingDetails.participants?.map((p) => ({
        email: p.email,
        displayName: p.name,
      })) || [];

    const event = {
      summary: meetingDetails.title,
      location: meetingDetails.location || meetingDetails.venue || "",
      description: meetingDetails.description || "",
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: "UTC",
      },
      attendees: attendees.length > 0 ? attendees : undefined,
    };

    await calendar.events.update({
      calendarId: "primary",
      eventId: eventId,
      resource: event,
    });

    console.log("✅ Google Calendar event updated:", eventId);

    connection.lastSyncAt = new Date();
    connection.syncStatus = "connected";
    connection.syncError = null;
    await connection.save();
  } catch (error) {
    console.error("❌ Error updating Google Calendar event:", error.message);

    const connection = await CalendarConnection.findOne({
      user: userId,
      provider: "google",
    });
    if (connection) {
      connection.syncStatus = "error";
      connection.syncError = error.message;
      await connection.save();
    }
  }
};

/**
 * Delete Google Calendar event
 */
export const deleteGoogleEvent = async (userId, eventId) => {
  try {
    const connection = await CalendarConnection.findOne({
      user: userId,
      provider: "google",
      syncStatus: "connected",
    });

    if (!connection) {
      console.log("No connected Google Calendar found for user");
      return;
    }

    const oAuth2Client = await getGoogleOAuth2Client(connection);
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    await calendar.events.delete({
      calendarId: "primary",
      eventId: eventId,
    });

    console.log("✅ Google Calendar event deleted:", eventId);

    connection.lastSyncAt = new Date();
    connection.syncStatus = "connected";
    connection.syncError = null;
    await connection.save();
  } catch (error) {
    console.error("❌ Error deleting Google Calendar event:", error.message);

    const connection = await CalendarConnection.findOne({
      user: userId,
      provider: "google",
    });
    if (connection) {
      connection.syncStatus = "error";
      connection.syncError = error.message;
      await connection.save();
    }
  }
};

/**
 * Create Microsoft Outlook event
 */
export const createMicrosoftEvent = async (userId, meetingDetails) => {
  try {
    const connection = await CalendarConnection.findOne({
      user: userId,
      provider: "microsoft",
      syncStatus: "connected",
    });

    if (!connection) {
      console.log("No connected Microsoft Calendar found for user");
      return null;
    }

    const client = await getMicrosoftClient(connection);

    const startDateTime = parseMeetingDateTime(meetingDetails);
    const duration = meetingDetails.duration || 60;
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    const attendees =
      meetingDetails.participants?.map((p) => ({
        emailAddress: {
          address: p.email,
          name: p.name,
        },
      })) || [];

    const event = {
      subject: meetingDetails.title,
      location: {
        displayName: meetingDetails.location || meetingDetails.venue || "",
      },
      body: {
        contentType: "Text",
        content: meetingDetails.description || "",
      },
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: "UTC",
      },
      attendees: attendees.length > 0 ? attendees : undefined,
    };

    const res = await client.api("/me/events").post(event);

    console.log("✅ Microsoft Calendar event created:", res.id);

    connection.lastSyncAt = new Date();
    connection.syncStatus = "connected";
    connection.syncError = null;
    await connection.save();

    return res.id;
  } catch (error) {
    console.error("❌ Error creating Microsoft Calendar event:", error.message);

    const connection = await CalendarConnection.findOne({
      user: userId,
      provider: "microsoft",
    });
    if (connection) {
      connection.syncStatus = "error";
      connection.syncError = error.message;
      await connection.save();
    }

    return null;
  }
};

/**
 * Update Microsoft Outlook event
 */
export const updateMicrosoftEvent = async (userId, meetingDetails, eventId) => {
  try {
    const connection = await CalendarConnection.findOne({
      user: userId,
      provider: "microsoft",
      syncStatus: "connected",
    });

    if (!connection) {
      console.log("No connected Microsoft Calendar found for user");
      return;
    }

    const client = await getMicrosoftClient(connection);

    const startDateTime = parseMeetingDateTime(meetingDetails);
    const duration = meetingDetails.duration || 60;
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    const attendees =
      meetingDetails.participants?.map((p) => ({
        emailAddress: {
          address: p.email,
          name: p.name,
        },
      })) || [];

    const event = {
      subject: meetingDetails.title,
      location: {
        displayName: meetingDetails.location || meetingDetails.venue || "",
      },
      body: {
        contentType: "Text",
        content: meetingDetails.description || "",
      },
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: "UTC",
      },
      attendees: attendees.length > 0 ? attendees : undefined,
    };

    await client.api(`/me/events/${eventId}`).patch(event);

    console.log("✅ Microsoft Calendar event updated:", eventId);

    connection.lastSyncAt = new Date();
    connection.syncStatus = "connected";
    connection.syncError = null;
    await connection.save();
  } catch (error) {
    console.error("❌ Error updating Microsoft Calendar event:", error.message);

    const connection = await CalendarConnection.findOne({
      user: userId,
      provider: "microsoft",
    });
    if (connection) {
      connection.syncStatus = "error";
      connection.syncError = error.message;
      await connection.save();
    }
  }
};

/**
 * Delete Microsoft Outlook event
 */
export const deleteMicrosoftEvent = async (userId, eventId) => {
  try {
    const connection = await CalendarConnection.findOne({
      user: userId,
      provider: "microsoft",
      syncStatus: "connected",
    });

    if (!connection) {
      console.log("No connected Microsoft Calendar found for user");
      return;
    }

    const client = await getMicrosoftClient(connection);

    await client.api(`/me/events/${eventId}`).delete();

    console.log("✅ Microsoft Calendar event deleted:", eventId);

    connection.lastSyncAt = new Date();
    connection.syncStatus = "connected";
    connection.syncError = null;
    await connection.save();
  } catch (error) {
    console.error("❌ Error deleting Microsoft Calendar event:", error.message);

    const connection = await CalendarConnection.findOne({
      user: userId,
      provider: "microsoft",
    });
    if (connection) {
      connection.syncStatus = "error";
      connection.syncError = error.message;
      await connection.save();
    }
  }
};

/**
 * Get Google OAuth authorization URL
 */
export const getGoogleAuthUrl = () => {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  const scopes = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ];

  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });
};

/**
 * Exchange Google authorization code for tokens
 */
export const getGoogleTokens = async (code) => {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  const { tokens } = await oAuth2Client.getToken(code);
  return tokens;
};

/**
 * Get Microsoft OAuth authorization URL
 */
export const getMicrosoftAuthUrl = async () => {
  const msalConfig = {
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      authority: "https://login.microsoftonline.com/common",
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    },
  };

  const pca = new (
    await import("@azure/msal-node")
  ).ConfidentialClientApplication(msalConfig);

  const authCodeUrlParameters = {
    scopes: ["https://graph.microsoft.com/Calendars.ReadWrite"],
    redirectUri: process.env.MICROSOFT_REDIRECT_URI,
  };

  return pca.getAuthCodeUrl(authCodeUrlParameters);
};

/**
 * Exchange Microsoft authorization code for tokens
 */
export const getMicrosoftTokens = async (code) => {
  const msalConfig = {
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      authority: "https://login.microsoftonline.com/common",
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    },
  };

  const pca = new (
    await import("@azure/msal-node")
  ).ConfidentialClientApplication(msalConfig);

  const tokenRequest = {
    code: code,
    scopes: ["https://graph.microsoft.com/Calendars.ReadWrite"],
    redirectUri: process.env.MICROSOFT_REDIRECT_URI,
  };

  const response = await pca.acquireTokenByCode(tokenRequest);
  return response;
};

/**
 * Get free/busy information for attendees
 */
export const getFreeBusy = async (userId, attendeeEmails, timeMin, timeMax) => {
  const freeBusyData = {
    google: {},
    microsoft: {},
  };

  // Get Google free/busy
  const googleConnection = await CalendarConnection.findOne({
    user: userId,
    provider: "google",
    syncStatus: "connected",
  });

  if (googleConnection) {
    try {
      const oAuth2Client = await getGoogleOAuth2Client(googleConnection);
      const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

      const requestBody = {
        timeMin: new Date(timeMin).toISOString(),
        timeMax: new Date(timeMax).toISOString(),
        items: attendeeEmails.map((email) => ({ id: email })),
      };

      const response = await calendar.freebusy.query({
        requestBody,
      });

      freeBusyData.google = response.data.calendars || {};
    } catch (error) {
      console.error("Error getting Google free/busy:", error.message);
    }
  }

  // Get Microsoft free/busy
  const microsoftConnection = await CalendarConnection.findOne({
    user: userId,
    provider: "microsoft",
    syncStatus: "connected",
  });

  if (microsoftConnection) {
    try {
      const client = await getMicrosoftClient(microsoftConnection);

      const schedule = await client.api("/me/calendar/getSchedule").post({
        schedules: attendeeEmails,
        startTime: {
          dateTime: new Date(timeMin).toISOString(),
          timeZone: "UTC",
        },
        endTime: {
          dateTime: new Date(timeMax).toISOString(),
          timeZone: "UTC",
        },
        availabilityViewInterval: 30,
      });

      freeBusyData.microsoft = schedule.value || [];
    } catch (error) {
      console.error("Error getting Microsoft free/busy:", error.message);
    }
  }

  return freeBusyData;
};

/**
 * Fetch external events for a user's calendar view
 */
export const fetchExternalEvents = async (userId, timeMin, timeMax) => {
  const events = {
    google: [],
    microsoft: [],
  };

  // Fetch Google events
  const googleConnection = await CalendarConnection.findOne({
    user: userId,
    provider: "google",
    syncStatus: "connected",
  });

  if (googleConnection) {
    try {
      const oAuth2Client = await getGoogleOAuth2Client(googleConnection);
      const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: new Date(timeMin).toISOString(),
        timeMax: new Date(timeMax).toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      events.google = response.data.items || [];
    } catch (error) {
      console.error("Error fetching Google events:", error.message);
    }
  }

  // Fetch Microsoft events
  const microsoftConnection = await CalendarConnection.findOne({
    user: userId,
    provider: "microsoft",
    syncStatus: "connected",
  });

  if (microsoftConnection) {
    try {
      const client = await getMicrosoftClient(microsoftConnection);

      const response = await client
        .api("/me/calendarView")
        .filter(
          `start/dateTime ge '${new Date(timeMin).toISOString()}' and end/dateTime le '${new Date(timeMax).toISOString()}'`,
        )
        .orderby("start/dateTime")
        .get();

      events.microsoft = response.value || [];
    } catch (error) {
      console.error("Error fetching Microsoft events:", error.message);
    }
  }

  return events;
};
