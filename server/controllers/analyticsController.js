import Meeting from "../models/meetingModel.js";
import Policy from "../models/policyModel.js";

export const getAnalytics = async (req, res) => {
  try {
    const totalMeetings = await Meeting.countDocuments();
    const totalPolicies = await Policy.countDocuments();
    const completedMeetings = await Meeting.countDocuments({ status: "completed" });
    const updatedPolicies = await Policy.countDocuments({ version: { $ne: "1.0" } });

    // Monthly trend (last 6 months)
    const lastSixMonths = new Date();
    lastSixMonths.setMonth(lastSixMonths.getMonth() - 5);
    const monthlyMeetings = await Meeting.aggregate([
      { $match: { createdAt: { $gte: lastSixMonths } } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    const monthlyPolicies = await Policy.aggregate([
      { $match: { createdAt: { $gte: lastSixMonths } } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    res.status(200).json({
      success: true,
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
    res.status(500).json({ success: false, message: "Failed to load analytics" });
  }
};
