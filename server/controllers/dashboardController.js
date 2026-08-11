import ActionItem from "../models/actionItemModel.js";
import Notification from "../models/notificationModel.js";
import Meeting from "../models/meetingModel.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

export const getDashboardMetrics = async (req, res) => {
  try {
    const organization = req.user?.organization;
    const userId = req.user?.id;

    if (!organization) {
      return sendError(res, 400, "Organization context is missing");
    }

    const now = new Date();

    const ownerIdentifiers = [
      userId?.toString(),
      userId,
      req.user?.email,
      req.user?.name,
    ].filter(Boolean);

    // Fire all three queries concurrently to ensure fast response times
    const [overdueTasks, unreadNotifications, upcomingMeetings] =
      await Promise.all([
        // 1. Overdue action items assigned to the user (owner field matches user id, email, or name)
        ActionItem.countDocuments({
          organization,
          owner: { $in: ownerIdentifiers },
          status: { $nin: ["resolved", "superseded"] },
          dueDate: { $lt: now },
        }),
        // 2. Unread notifications for the user (user field)
        Notification.countDocuments({
          user: userId,
          isRead: false,
        }),
        // 3. Upcoming meetings in the organization (organization field)
        Meeting.countDocuments({
          organization,
          date: { $gte: now },
        }),
      ]);

    sendSuccess(res, {
      metrics: {
        overdueTasks,
        unreadNotifications,
        upcomingMeetings,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard metrics:", error);
    sendError(res, 500, "Failed to retrieve dashboard metrics");
  }
};
