import notificationModel from "../models/notificationModel.js";
import NotificationPreference from "../models/notificationPreferenceModel.js";

const categoryToPreferenceField = {
  meetings: "pushMeetingReminders",
  ai_processing: "pushAiProcessingComplete",
  system: null,
  organizations: null,
  policies: null,
  reports: null,
};

/**
 * Checks whether a given user has opted out of push notifications for a category.
 */
const shouldSuppressPush = async (userId, category) => {
  const field = categoryToPreferenceField[category];
  if (!field) return false;

  try {
    const prefs = await NotificationPreference.findOne({ user: userId });
    if (!prefs) return false;
    return prefs[field] === false;
  } catch {
    return false;
  }
};

/**
 * Creates a notification in the database
 *
 * @param {string} userId - The ID of the user to notify
 * @param {string} title - Notification title
 * @param {string} description - Notification description
 * @param {string} category - Category (e.g., "meetings", "organizations", "system", "ai_processing")
 * @param {string} actionUrl - URL to navigate to when clicked (optional)
 * @param {string} actionLabel - Label for the action button (optional)
 * @param {object} metadata - Additional metadata (optional)
 */
export const createNotification = async (
  userId,
  title,
  description,
  category = "system",
  actionUrl = "",
  actionLabel = "",
  metadata = {},
) => {
  try {
    const suppressed = await shouldSuppressPush(userId, category);
    if (suppressed) {
      console.log(
        `🔇 Notification suppressed for user ${userId} — category "${category}" disabled in preferences`,
      );
      return null;
    }

    // 1. Create notification in database
    const notification = await notificationModel.create({
      user: userId,
      title,
      description,
      category,
      actionUrl,
      actionLabel,
      metadata,
    });

    // 2. Format the response object (similar to how notificationController does)
    const formattedNotification = {
      id: notification._id,
      title: notification.title,
      description: notification.description,
      category: notification.category,
      isRead: notification.isRead,
      actionUrl: notification.actionUrl,
      actionLabel: notification.actionLabel,
      metadata: notification.metadata,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };

    return formattedNotification;
  } catch (error) {
    console.error("Error creating and pushing notification:", error);
    // Don't throw the error, just return null so it doesn't break the main flow (e.g., meeting creation)
    return null;
  }
};
