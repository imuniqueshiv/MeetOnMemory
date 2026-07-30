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

    // Fire all three queries concurrently to ensure fast response times
    const [overdueTasks, unreadNotifications, upcomingMeetings] =
      await Promise.all([
        // 1. Overdue action items assigned to the user
        ActionItem.countDocuments({
          organization,
          assignees: userId,
          status: { $nin: ["resolved", "superseded"] },
          dueDate: { $lt: now },
        }),
        // 2. Unread notifications for the user
        Notification.countDocuments({
          recipient: userId,
          isRead: false,
        }),
        // 3. Upcoming meetings in the organization
        Meeting.countDocuments({
          organizationId: organization,
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
