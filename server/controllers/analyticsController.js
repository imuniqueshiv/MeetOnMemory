import Meeting from "../models/meetingModel.js";
import Policy from "../models/policyModel.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

export const subtractMonthsClamped = (date, months) => {
  const result = new Date(date);
  const dayOfMonth = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() - months);

  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(dayOfMonth, lastDayOfTargetMonth));

  return result;
};

export const getAnalytics = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return sendError(res, 401, "Unauthorized");
    }

    const queryOptions = [{ uploadedBy: userId }];
    if (req.user?.organization) {
      queryOptions.push({ organization: req.user.organization });
    }
    const matchQuery = { $or: queryOptions };

    const totalMeetings = await Meeting.countDocuments(matchQuery);
    const totalPolicies = await Policy.countDocuments(matchQuery);
    const completedMeetings = await Meeting.countDocuments({
      ...matchQuery,
      status: "completed",
    });
    const updatedPolicies = await Policy.countDocuments({
      ...matchQuery,
      version: { $ne: "1.0" },
    });

    // Monthly trend (last 6 months)
    const lastSixMonths = subtractMonthsClamped(new Date(), 5);
    const monthlyMeetings = await Meeting.aggregate([
      { $match: { createdAt: { $gte: lastSixMonths }, ...matchQuery } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthlyPolicies = await Policy.aggregate([
      { $match: { createdAt: { $gte: lastSixMonths }, ...matchQuery } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    sendSuccess(res, {
      summary: {
        totalMeetings,
        completedMeetings,
        totalPolicies,
        updatedPolicies,
      },
      trends: { monthlyMeetings, monthlyPolicies },
    });
  } catch (error) {
    console.error("❌ Analytics Error:", error);
    sendError(res, 500, "Failed to load analytics");
  }
};
