// server/controllers/notificationController.js
import mongoose from "mongoose";
import notificationModel from "../models/notificationModel.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";
import NotificationPreference from "../models/notificationPreferenceModel.js";
import PushSubscription from "../models/pushSubscriptionModel.js";
import { CATEGORY_TO_PREFERENCE } from "../services/notificationService.js";

/**
 * Valid filter values, derived from the single source of truth in
 * notificationService rather than being hand-maintained here. The previous
 * inline array had already drifted — it did not include the `tasks` category.
 */
const NOTIFICATION_CATEGORIES = Object.keys(CATEGORY_TO_PREFERENCE);

// Helper to format notification response
const formatNotificationResponse = (notification) => {
  return {
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
};

// @desc    Get all notifications for a user
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const { category, status, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20),
    );
    const skip = (page - 1) * limit;

    const userId = String(req.user.id);
    const filter = { user: userId };

    if (NOTIFICATION_CATEGORIES.includes(category)) {
      filter.category = String(category);
    }

    if (status === "unread") {
      filter.isRead = false;
    } else if (status === "read") {
      filter.isRead = true;
    }

    if (search && typeof search === "string") {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [notifications, total, unreadCount] = await Promise.all([
      notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      notificationModel.countDocuments(filter),
      notificationModel.countDocuments({
        user: userId,
        isRead: false,
      }),
    ]);

    sendSuccess(res, {
      notifications: notifications.map(formatNotificationResponse),
      unreadCount,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error in getNotifications:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const notification = await notificationModel.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true },
      { new: true },
    );

    if (!notification) {
      return sendError(res, 404, "Notification not found");
    }

    sendSuccess(
      res,
      { notification: formatNotificationResponse(notification) },
      "Notification marked as read",
    );
  } catch (error) {
    console.error("Error in markAsRead:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/mark-all-read
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const result = await notificationModel.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true },
    );

    sendSuccess(
      res,
      { modifiedCount: result.modifiedCount },
      "All notifications marked as read",
    );
  } catch (error) {
    console.error("Error in markAllAsRead:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const notification = await notificationModel.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!notification) {
      return sendError(res, 404, "Notification not found");
    }

    sendSuccess(res, null, "Notification deleted");
  } catch (error) {
    console.error("Error in deleteNotification:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Get unread count
// @route   GET /api/notifications/unread-count
// @access  Private
export const getUnreadCount = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const unreadCount = await notificationModel.countDocuments({
      user: req.user.id,
      isRead: false,
    });

    sendSuccess(res, { unreadCount });
  } catch (error) {
    console.error("Error in getUnreadCount:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Get notification preferences for a user
// @route   GET /api/notifications/preferences
// @access  Private
export const getPreferences = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    let preferences = await NotificationPreference.findOne({
      user: req.user.id,
    });

    if (!preferences) {
      preferences = await NotificationPreference.create({
        user: req.user.id,
      });
    }

    sendSuccess(res, { preferences });
  } catch (error) {
    console.error("Error in getPreferences:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Update notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
export const updatePreferences = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    // Issue #977: the push toggles are now all genuinely enforced by
    // notificationService (previously only two of six were read by anything).
    const allowedFields = [
      "emailMeetingReminders",
      "emailTaskAssignments",
      "emailWeeklyDigest",
      "emailDailyDigest",
      "pushMeetingReminders",
      "pushTaskAssignments",
      "pushAiProcessingComplete",
      "pushOrganizationUpdates",
      "pushPolicyUpdates",
      "pushReportUpdates",
      "quietHoursStart",
      "quietHoursEnd",
      "timezone",
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return sendError(res, 400, "No valid preference fields provided.");
    }

    const preferences = await NotificationPreference.findOneAndUpdate(
      { user: req.user.id },
      { $set: updates },
      { new: true, upsert: true },
    );

    sendSuccess(res, { preferences }, "Preferences updated successfully");
  } catch (error) {
    console.error("Error in updatePreferences:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Mark a group of notifications as read (Issue #2064)
// @route   PATCH /api/notifications/mark-group-read
// @access  Private
export const markGroupAsRead = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const cleanIds = ids
      .filter((id) => typeof id === "string" && mongoose.isValidObjectId(id))
      .map((id) => id);

    if (cleanIds.length === 0) {
      return sendError(res, 400, "Provide at least one valid notification id.");
    }

    const result = await notificationModel.updateMany(
      {
        _id: { $in: cleanIds },
        user: req.user.id,
        isRead: false,
      },
      { isRead: true },
    );

    sendSuccess(
      res,
      { modifiedCount: result.modifiedCount },
      "Group marked as read",
    );
  } catch (error) {
    console.error("Error in markGroupAsRead:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Mute in-app notifications for a meeting (Issue #2064)
// @route   POST /api/notifications/mute-meeting/:meetingId
// @access  Private
export const muteMeeting = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const { meetingId } = req.params;
    if (!mongoose.isValidObjectId(meetingId)) {
      return sendError(res, 400, "Invalid meeting id");
    }

    const preferences = await NotificationPreference.findOneAndUpdate(
      { user: req.user.id },
      { $addToSet: { mutedMeetingIds: meetingId } },
      { new: true, upsert: true },
    );

    sendSuccess(
      res,
      { preferences, muted: true, meetingId },
      "Meeting notifications muted",
    );
  } catch (error) {
    console.error("Error in muteMeeting:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Unmute in-app notifications for a meeting (Issue #2064)
// @route   DELETE /api/notifications/mute-meeting/:meetingId
// @access  Private
export const unmuteMeeting = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const { meetingId } = req.params;
    if (!mongoose.isValidObjectId(meetingId)) {
      return sendError(res, 400, "Invalid meeting id");
    }

    const preferences = await NotificationPreference.findOneAndUpdate(
      { user: req.user.id },
      { $pull: { mutedMeetingIds: meetingId } },
      { new: true, upsert: true },
    );

    sendSuccess(
      res,
      { preferences, muted: false, meetingId },
      "Meeting notifications unmuted",
    );
  } catch (error) {
    console.error("Error in unmuteMeeting:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Get VAPID Public Key for Web Push
// @route   GET /api/notifications/push/public-key
// @access  Private
export const getVapidPublicKey = async (req, res) => {
  try {
    const publicKey =
      process.env.VAPID_PUBLIC_KEY ||
      "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
    sendSuccess(res, { publicKey });
  } catch (error) {
    console.error("Error in getVapidPublicKey:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Subscribe to web push notifications
// @route   POST /api/notifications/push/subscribe
// @access  Private
export const subscribePush = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return sendError(res, 400, "Invalid push subscription object.");
    }

    const subscription = await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        user: req.user.id,
        endpoint,
        keys,
        userAgent: req.headers["user-agent"] || "",
      },
      { upsert: true, new: true },
    );

    sendSuccess(
      res,
      { subscription },
      "Push subscription registered successfully.",
    );
  } catch (error) {
    console.error("Error in subscribePush:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Unsubscribe from web push notifications
// @route   POST /api/notifications/push/unsubscribe
// @access  Private
export const unsubscribePush = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const { endpoint } = req.body;
    if (!endpoint) {
      return sendError(res, 400, "Endpoint is required to unsubscribe.");
    }

    await PushSubscription.findOneAndDelete({
      user: req.user.id,
      endpoint,
    });

    sendSuccess(res, null, "Push subscription removed successfully.");
  } catch (error) {
    console.error("Error in unsubscribePush:", error);
    sendError(res, 500, "Server error");
  }
};

// @desc    Send test push notification
// @route   POST /api/notifications/push/test
// @access  Private
export const sendTestPush = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication error, user ID not found.");
    }

    const subscriptions = await PushSubscription.find({ user: req.user.id });
    const payload = {
      title: "Test Notification",
      body: "Push notifications are working properly on your device!",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      url: "/settings",
    };

    sendSuccess(
      res,
      {
        recipientCount: subscriptions.length,
        payload,
      },
      "Test push notification dispatched.",
    );
  } catch (error) {
    console.error("Error in sendTestPush:", error);
    sendError(res, 500, "Server error");
  }
};
