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

    const query = { organization: orgId };
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const meetings = await Meeting.find(query)
      .select("date participants.name participants.email")
      .lean();

    const totalMeetings = meetings.length;

    // Map: member name/email -> { count, sparklineData }
    const memberStats = {};

    meetings.forEach((meeting) => {
      const meetingDate = new Date(meeting.date).toISOString().split("T")[0];

      meeting.participants.forEach((p) => {
        const key = p.email || p.name;
        if (!memberStats[key]) {
          memberStats[key] = {
            name: p.name,
            email: p.email,
            attended: 0,
            datesAttended: new Set(),
          };
        }
        memberStats[key].attended += 1;
        memberStats[key].datesAttended.add(meetingDate);
      });
    });

    const statsArray = Object.values(memberStats).map((member) => ({
      name: member.name,
      email: member.email,
      attended: member.attended,
      attendanceRate:
        totalMeetings > 0 ? (member.attended / totalMeetings) * 100 : 0,
      sparkline: Array.from(member.datesAttended), // Array of dates they attended
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

    const query = { organization: orgId };
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const meetings = await Meeting.find(query).select("date").lean();

    const heatmapData = {};

    meetings.forEach((meeting) => {
      const dateKey = new Date(meeting.date).toISOString().split("T")[0];
      if (!heatmapData[dateKey]) {
        heatmapData[dateKey] = 0;
      }
      heatmapData[dateKey] += 1;
    });

    // Format for typical calendar heatmap (array of { date, count })
    const formattedData = Object.keys(heatmapData).map((date) => ({
      date,
      count: heatmapData[date],
    }));

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
    // granularity can be 'daily', 'weekly', 'monthly'

    const query = { organization: orgId };
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const meetings = await Meeting.find(query)
      .select("date participants")
      .sort("date")
      .lean();

    const trendMap = {};

    meetings.forEach((meeting) => {
      const dateObj = new Date(meeting.date);
      let key = dateObj.toISOString().split("T")[0]; // daily

      if (granularity === "weekly") {
        // Group by ISO week year-week (simplified)
        const d = new Date(
          Date.UTC(
            dateObj.getFullYear(),
            dateObj.getMonth(),
            dateObj.getDate(),
          ),
        );
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
        key = `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
      } else if (granularity === "monthly") {
        key = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, "0")}`;
      }

      if (!trendMap[key]) {
        trendMap[key] = {
          dateLabel: key,
          meetings: 0,
          totalParticipants: 0,
        };
      }

      trendMap[key].meetings += 1;
      trendMap[key].totalParticipants += meeting.participants.length;
    });

    const trends = Object.values(trendMap).map((t) => ({
      ...t,
      avgParticipants: t.meetings > 0 ? t.totalParticipants / t.meetings : 0,
    }));

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

    const query = { organization: orgId };
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const meetings = await Meeting.find(query).select("meetingType").lean();

    const typeCounts = {};
    meetings.forEach((m) => {
      const type = m.meetingType || "uncategorized";
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const breakdown = Object.keys(typeCounts).map((type) => ({
      name: type,
      value: typeCounts[type],
    }));

    res.status(200).json(breakdown);
  } catch (error) {
    console.error("Error fetching meeting types:", error);
    res.status(500).json({ message: "Server error fetching meeting types" });
  }
};
