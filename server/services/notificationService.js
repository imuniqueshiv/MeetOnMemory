import notificationModel from "../models/notificationModel.js";
import NotificationPreference from "../models/notificationPreferenceModel.js";
import QueuedNotification from "../models/queuedNotificationModel.js";
import EmailService from "./EmailService.js";
import { sendSlackNotification } from "./slackService.js";
import User from "../models/userModel.js";

export const CATEGORY_TO_PREFERENCE = Object.freeze({
  meetings: "pushMeetingReminders",
  tasks: "pushTaskAssignments",
  ai_processing: "pushAiProcessingComplete",
  organizations: "pushOrganizationUpdates",
  policies: "pushPolicyUpdates",
  reports: "pushReportUpdates",
  system: null,
});

/**
 * Maps a notification context to a simplified routing category: slaAlerts, comments, or recaps.
 */
export const getRoutingCategory = (category, title, description) => {
  const text =
    `${title || ""} ${description || ""} ${category || ""}`.toLowerCase();
  if (
    text.includes("sla") ||
    text.includes("breach") ||
    text.includes("due") ||
    text.includes("mitigate") ||
    category === "tasks" ||
    category === "policies"
  ) {
    return "slaAlerts";
  }
  if (
    text.includes("comment") ||
    text.includes("reply") ||
    category === "comments"
  ) {
    return "comments";
  }
  return "recaps";
};

/**
 * Validates action URLs, repairing relative links and guaranteeing valid URL structures.
 */
export const validateAndRepairLink = (url) => {
  if (!url) return "";
  let repairedUrl = url;
  if (url.startsWith("/")) {
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    repairedUrl = `${baseUrl}${url}`;
  }
  try {
    new URL(repairedUrl);
    return repairedUrl;
  } catch {
    return `${process.env.FRONTEND_URL || "http://localhost:3000"}/dashboard`;
  }
};

/**
 * Queues notification templates for future processed deliveries or immediate dispatch.
 */
export const createNotifications = async (recipients, payload) => {
  const {
    title,
    description,
    category = "system",
    actionUrl = "",
    actionLabel = "",
    metadata = {},
    forceImmediate = false,
  } = payload ?? {};

  if (!Array.isArray(recipients) || recipients.length === 0) return [];
  if (!title || !description) {
    console.warn(
      "⚠️ createNotifications: title and description are required — skipping.",
    );
    return [];
  }

  const uniqueIds = [
    ...new Set(recipients.filter(Boolean).map((id) => String(id))),
  ];
  if (uniqueIds.length === 0) return [];

  const createdLogs = [];
  try {
    const users = await User.find({ _id: { $in: uniqueIds } });
    const prefs = await NotificationPreference.find({
      user: { $in: uniqueIds },
    });

    const userMap = users.reduce((acc, user) => {
      acc[user._id.toString()] = user;
      return acc;
    }, {});

    const prefMap = prefs.reduce((acc, pref) => {
      acc[pref.user.toString()] = pref;
      return acc;
    }, {});

    for (const userId of uniqueIds) {
      const userPrefs = prefMap[userId];
      const routingCat = getRoutingCategory(category, title, description);
      const routing = userPrefs?.routingPreferences?.[routingCat] || {
        slack: true,
        email: true,
        inApp: true,
      };

      // Auto-repair action URLs
      const repairedUrl = validateAndRepairLink(actionUrl);

      // Check if all channels are turned off for this preference
      if (!routing.slack && !routing.email && !routing.inApp) {
        continue;
      }

      const threshold = forceImmediate
        ? 0
        : (userPrefs?.batchThresholdMinutes ?? 5);

      if (threshold === 0) {
        // Dispatch immediately
        const user = userMap[userId];
        if (routing.inApp) {
          const log = await notificationModel.create({
            user: userId,
            title,
            description,
            category,
            actionUrl: repairedUrl,
            actionLabel,
            metadata,
          });
          createdLogs.push(log);
        }
        if (routing.email && user?.email) {
          await EmailService.sendNotificationEmail(
            user.email,
            title,
            description,
          );
        }
        if (routing.slack && user?.organization) {
          await sendSlackNotification(
            user.organization,
            `*${title}*\n${description}`,
          );
        }
      } else {
        // Queue notification
        const processAfter = new Date(Date.now() + threshold * 60 * 1000);
        await QueuedNotification.create({
          userId,
          title,
          description,
          category,
          actionUrl: repairedUrl,
          actionLabel,
          metadata,
          processAfter,
          status: "pending",
        });
      }
    }
  } catch (error) {
    console.error("Error creating queued notifications:", error);
  }

  return createdLogs;
};

/**
 * Process pending queued notifications, aggregating them into digest summaries.
 */
export const processNotificationQueue = async () => {
  try {
    const now = new Date();
    const pending = await QueuedNotification.find({
      status: "pending",
      processAfter: { $lte: now },
    });

    if (pending.length === 0) return;

    const groups = {};
    for (const item of pending) {
      const routingCat = getRoutingCategory(
        item.category,
        item.title,
        item.description,
      );
      const key = `${item.userId}_${routingCat}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }

    const processedIds = [];
    const failedIds = [];

    for (const key in groups) {
      const items = groups[key];
      const firstItem = items[0];
      const userId = firstItem.userId;
      const category = firstItem.category;
      const itemIds = items.map((it) => it._id);

      try {
        const user = await User.findById(userId);
        if (!user) {
          failedIds.push(...itemIds);
          continue;
        }

        const prefs = await NotificationPreference.findOne({ user: userId });
        const routingCat = getRoutingCategory(
          category,
          firstItem.title,
          firstItem.description,
        );
        const routing = prefs?.routingPreferences?.[routingCat] || {
          slack: true,
          email: true,
          inApp: true,
        };

        let finalTitle = firstItem.title;
        let finalDescription = firstItem.description;
        let finalActionUrl = firstItem.actionUrl;

        if (items.length > 1) {
          finalTitle = `[Digest] You have ${items.length} new updates in ${
            routingCat === "slaAlerts"
              ? "SLAs"
              : routingCat === "comments"
                ? "Comments"
                : "Recaps"
          }`;
          finalDescription = items
            .map((it, idx) => `${idx + 1}. ${it.title}: ${it.description}`)
            .join("\n");
        }

        if (routing.inApp) {
          await notificationModel.create({
            user: userId,
            title: finalTitle,
            description: finalDescription,
            category,
            actionUrl: finalActionUrl,
            actionLabel: firstItem.actionLabel,
            metadata: firstItem.metadata,
          });
        }

        if (routing.email && user.email) {
          await EmailService.sendNotificationEmail(
            user.email,
            finalTitle,
            finalDescription,
          );
        }

        if (routing.slack && user.organization) {
          await sendSlackNotification(
            user.organization,
            `*${finalTitle}*\n${finalDescription}`,
          );
        }

        processedIds.push(...itemIds);
      } catch (err) {
        console.error(
          `❌ Failed to dispatch notifications for user ${userId}:`,
          err,
        );
        failedIds.push(...itemIds);
      }
    }

    if (processedIds.length > 0 || failedIds.length > 0) {
      const bulkOps = [];
      if (processedIds.length > 0) {
        bulkOps.push({
          updateMany: {
            filter: { _id: { $in: processedIds } },
            update: { $set: { status: "processed" } },
          },
        });
      }
      if (failedIds.length > 0) {
        bulkOps.push({
          updateMany: {
            filter: { _id: { $in: failedIds } },
            update: { $set: { status: "failed" } },
          },
        });
      }
      await QueuedNotification.bulkWrite(bulkOps);
    }
  } catch (error) {
    console.error("❌ Error in processNotificationQueue:", error);
  }
};

export const createNotification = async (
  userId,
  title,
  description,
  category = "system",
  actionUrl = "",
  actionLabel = "",
  metadata = {},
  forceImmediate = false,
) => {
  if (!userId) return null;

  const [notification] = await createNotifications([userId], {
    title,
    description,
    category,
    actionUrl,
    actionLabel,
    metadata,
    forceImmediate,
  });

  return notification ?? null;
};

/** @deprecated Prefer createNotification. */
export const notifyUser = async (
  userId,
  category,
  description,
  metadata = {},
) =>
  createNotification(userId, category, description, category, "", "", metadata);
