import Meeting from "../models/meetingModel.js";

/**
 * @desc    Get member attendance statistics (rates, sparklines)
 * @route   GET /api/attendance-analytics/stats
 * @access  Private
 */
export const getMemberAttendanceStats = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { startDate, endDate } = req.query;

    const matchQuery = { organization: orgId };
    if (startDate && endDate) {
      matchQuery.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const [totalMeetings, memberAgg] = await Promise.all([
      Meeting.countDocuments(matchQuery),
      Meeting.aggregate([
        { $match: matchQuery },
        { $unwind: "$participants" },
        {
          $group: {
            _id: {
              $ifNull: ["$participants.email", "$participants.name"],
            },
            name: { $first: "$participants.name" },
            email: { $first: "$participants.email" },
            attended: { $sum: 1 },
            datesAttended: {
              $addToSet: {
                $dateToString: { format: "%Y-%m-%d", date: "$date" },
              },
            },
          },
        },
      ]),
    ]);

    const statsArray = memberAgg.map((member) => ({
      name: member.name,
      email: member.email,
      attended: member.attended,
      attendanceRate:
        totalMeetings > 0 ? (member.attended / totalMeetings) * 100 : 0,
      sparkline: Array.from(member.datesAttended),
    }));

    res.status(200).json({ stats: statsArray, totalMeetings });
  } catch (error) {
    console.error("Error fetching member attendance stats:", error);
    res.status(500).json({ message: "Server error fetching attendance stats" });
  }
};

/**
 * @desc    Get daily attendance counts for heatmap
 * @route   GET /api/attendance-analytics/heatmap
 * @access  Private
 */
export const getAttendanceHeatmap = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { startDate, endDate } = req.query;

    const matchQuery = { organization: orgId };
    if (startDate && endDate) {
      matchQuery.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const formattedData = await Meeting.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          count: 1,
        },
      },
    ]);

    res.status(200).json(formattedData);
  } catch (error) {
    console.error("Error fetching attendance heatmap:", error);
    res
      .status(500)
      .json({ message: "Server error fetching attendance heatmap" });
  }
};

/**
 * @desc    Get attendance trends over time (granularity)
 * @route   GET /api/attendance-analytics/trends
 * @access  Private
 */
export const getAttendanceTrends = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { startDate, endDate, granularity = "daily" } = req.query;

    const matchQuery = { organization: orgId };
    if (startDate && endDate) {
      matchQuery.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    let dateGroupExpression;
    if (granularity === "weekly") {
      dateGroupExpression = {
        $concat: [
          { $dateToString: { format: "%G-W", date: "$date" } },
          { $dateToString: { format: "%V", date: "$date" } },
        ],
      };
    } else if (granularity === "monthly") {
      dateGroupExpression = {
        $dateToString: { format: "%Y-%m", date: "$date" },
      };
    } else {
      dateGroupExpression = {
        $dateToString: { format: "%Y-%m-%d", date: "$date" },
      };
    }

    const trends = await Meeting.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: dateGroupExpression,
          meetings: { $sum: 1 },
          totalParticipants: {
            $sum: { $size: { $ifNull: ["$participants", []] } },
          },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          dateLabel: "$_id",
          meetings: 1,
          totalParticipants: 1,
          avgParticipants: {
            $cond: [
              { $gt: ["$meetings", 0] },
              { $divide: ["$totalParticipants", "$meetings"] },
              0,
            ],
          },
        },
      },
    ]);

    res.status(200).json(trends);
  } catch (error) {
    console.error("Error fetching attendance trends:", error);
    res
      .status(500)
      .json({ message: "Server error fetching attendance trends" });
  }
};

/**
 * @desc    Get meeting type breakdown
 * @route   GET /api/attendance-analytics/types
 * @access  Private
 */
export const getMeetingTypeBreakdown = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { startDate, endDate } = req.query;

    const matchQuery = { organization: orgId };
    if (startDate && endDate) {
      matchQuery.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const breakdown = await Meeting.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $ifNull: ["$meetingType", "uncategorized"] },
          value: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          value: 1,
        },
      },
    ]);

    res.status(200).json(breakdown);
  } catch (error) {
    console.error("Error fetching meeting types:", error);
    res.status(500).json({ message: "Server error fetching meeting types" });
  }
};
