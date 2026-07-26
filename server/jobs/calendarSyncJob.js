import CalendarConnection from "../models/calendarConnectionModel.js";
import Meeting from "../models/meetingModel.js";
import {
  fetchExternalEvents,
  decryptToken, // eslint-disable-line no-unused-vars
  getGoogleOAuth2Client, // eslint-disable-line no-unused-vars
  getMicrosoftClient, // eslint-disable-line no-unused-vars
} from "../services/calendarService.js";
import { google } from "googleapis"; // eslint-disable-line no-unused-vars

/**
 * Background sync job for calendar reconciliation
 * This job periodically fetches external calendar events and syncs them back to MeetOnMemory
 * It handles conflict resolution using a "last modified wins" strategy
 */

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

let syncIntervalId = null;

/**
 * Sync external calendar events for a specific user and provider
 */
const syncUserCalendar = async (userId, provider) => {
  try {
    const connection = await CalendarConnection.findOne({
      user: userId,
      provider,
      syncStatus: "connected",
    });

    if (!connection) {
      console.log(`No active ${provider} connection for user ${userId}`);
      return;
    }

    // Calculate sync window (last 30 days to next 90 days)
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);

    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 90);

    // Fetch external events
    const externalEvents = await fetchExternalEvents(
      userId,
      timeMin.toISOString(),
      timeMax.toISOString(),
    );

    if (!externalEvents || !externalEvents[provider]) {
      console.log(
        `No external events found for ${provider} for user ${userId}`,
      );
      return;
    }

    const events = externalEvents[provider];
    let syncedCount = 0;
    let conflictCount = 0;

    for (const externalEvent of events) {
      const externalEventId = externalEvent.id;
      const externalEventTitle =
        externalEvent.summary || externalEvent.title || "External Event";
      const externalEventStart =
        externalEvent.start?.dateTime || externalEvent.start?.date;
      const externalEventEnd =
        externalEvent.end?.dateTime || externalEvent.end?.date;
      const externalEventUpdated =
        externalEvent.updated || externalEvent.lastModifiedDateTime;

      // Check if this event is already synced
      const existingMeeting = await Meeting.findOne({
        uploadedBy: userId,
        [`calendarEvents.${provider}.eventId`]: externalEventId,
      });

      if (existingMeeting) {
        // Event already synced - check for updates
        const lastSyncTime =
          existingMeeting.calendarEvents?.[provider]?.syncedAt;

        if (lastSyncTime && externalEventUpdated) {
          const lastModifiedDate = new Date(externalEventUpdated);
          const syncDate = new Date(lastSyncTime);

          // If external event was modified after last sync, update the meeting
          if (lastModifiedDate > syncDate) {
            console.log(
              `Updating meeting ${existingMeeting._id} from ${provider} calendar`,
            );

            existingMeeting.title = externalEventTitle;
            if (externalEventStart)
              existingMeeting.date = new Date(externalEventStart);
            if (externalEvent.description)
              existingMeeting.description = externalEvent.description;

            existingMeeting.calendarEvents[provider].syncedAt = new Date();
            await existingMeeting.save();
            syncedCount++;
          }
        }
      } else {
        // New external event - create a meeting record
        console.log(
          `Creating new meeting from ${provider} event: ${externalEventTitle}`,
        );

        const _newMeeting = await Meeting.create({
          uploadedBy: userId,
          title: externalEventTitle,
          description: externalEvent.description || "",
          date: externalEventStart ? new Date(externalEventStart) : new Date(),
          time: externalEventStart
            ? new Date(externalEventStart).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "",
          duration:
            externalEventStart && externalEventEnd
              ? Math.round(
                  (new Date(externalEventEnd) - new Date(externalEventStart)) /
                    60000,
                )
              : null,
          location: externalEvent.location || "",
          calendarEvents: {
            [provider]: {
              eventId: externalEventId,
              syncedAt: new Date(),
            },
          },
          status: "uploaded",
          transcript: "",
          summary: "",
        });

        syncedCount++;
      }
    }

    // Update connection sync status
    connection.lastSyncAt = new Date();
    connection.syncError = null;
    await connection.save();

    console.log(
      `Synced ${syncedCount} events for ${provider} for user ${userId}`,
    );
    return { syncedCount, conflictCount };
  } catch (error) {
    console.error(
      `Error syncing ${provider} calendar for user ${userId}:`,
      error.message,
    );

    // Update connection with error
    try {
      const connection = await CalendarConnection.findOne({
        user: userId,
        provider,
      });
      if (connection) {
        connection.syncStatus = "error";
        connection.syncError = error.message;
        await connection.save();
      }
    } catch (updateError) {
      console.error("Error updating connection status:", updateError.message);
    }

    throw error;
  }
};

/**
 * Sync all connected calendars for all users
 */
const syncAllCalendars = async () => {
  console.log("Starting calendar sync job...");

  try {
    const connections = await CalendarConnection.find({
      syncStatus: "connected",
    });

    if (connections.length === 0) {
      console.log("No active calendar connections to sync");
      return;
    }

    console.log(`Found ${connections.length} active calendar connections`);

    for (const connection of connections) {
      try {
        await syncUserCalendar(connection.user, connection.provider);
      } catch (error) {
        console.error(
          `Failed to sync ${connection.provider} for user ${connection.user}:`,
          error.message,
        );
      }
    }

    console.log("Calendar sync job completed");
  } catch (error) {
    console.error("Error in calendar sync job:", error.message);
  }
};

/**
 * Start the calendar sync job
 */
export const startCalendarSyncJob = () => {
  if (syncIntervalId) {
    console.log("Calendar sync job already running");
    return;
  }

  console.log("Starting calendar sync job (interval: 15 minutes)");

  // Run immediately on start
  syncAllCalendars();

  // Schedule recurring sync
  syncIntervalId = setInterval(syncAllCalendars, SYNC_INTERVAL_MS);
};

/**
 * Stop the calendar sync job
 */
export const stopCalendarSyncJob = () => {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log("Calendar sync job stopped");
  }
};

/**
 * Manual trigger for calendar sync (useful for testing)
 */
export const triggerManualSync = async (userId = null, provider = null) => {
  if (userId && provider) {
    return await syncUserCalendar(userId, provider);
  } else {
    return await syncAllCalendars();
  }
};

export default {
  startCalendarSyncJob,
  stopCalendarSyncJob,
  triggerManualSync,
};
