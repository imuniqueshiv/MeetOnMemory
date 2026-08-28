import mongoose from "mongoose";
import SentimentTimeline from "../models/sentimentTimelineModel.js";
import { generateSentimentTimeline } from "../services/sentimentTimelineService.js";
import Meeting from "../models/meetingModel.js";
import { canAccessMeetingDoc } from "../middleware/rbac.js";

// Fetch existing timeline
export const getTimeline = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid meeting ID format" });
    }

    // Authorization check
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    if (!canAccessMeetingDoc(meeting, req.user)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this meeting",
      });
    }

    const timeline = await SentimentTimeline.findOne({ meeting: meetingId });
    if (!timeline) {
      return res
        .status(404)
        .json({ success: false, message: "Timeline not found" });
    }

    return res.status(200).json({ success: true, timeline });
  } catch (error) {
    console.error("Error fetching sentiment timeline:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

// Generate (or regenerate) timeline
export const generateTimeline = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid meeting ID format" });
    }

    // Authorization check
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    if (!canAccessMeetingDoc(meeting, req.user)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You don't have access to this meeting",
      });
    }

    // Call service to generate
    const timeline = await generateSentimentTimeline(meetingId);

    return res.status(200).json({ success: true, timeline });
  } catch (error) {
    console.error("Error generating sentiment timeline:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate timeline",
      error: error.message,
    });
  }
};

// 3. GET /api/sentiment-timeline/organization/:organizationId/trends
export const getOrgSentimentTrends = async (req, res) => {
  try {
    const organizationId =
      req.params.organizationId ||
      req.query.organizationId ||
      req.user?.organization?.toString() ||
      "";

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid organization ID format" });
    }

    const { days = 30 } = req.query;
    const daysNum = Math.max(1, Math.min(365, parseInt(days, 10) || 30));
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysNum);

    // Find meetings in the organization within time window
    const orgMeetings = await Meeting.find({
      organization: organizationId,
      date: { $gte: sinceDate },
    })
      .select("_id title date duration tags")
      .sort({ date: 1 })
      .lean();

    const meetingMap = new Map();
    orgMeetings.forEach((m) => meetingMap.set(m._id.toString(), m));
    const meetingIds = orgMeetings.map((m) => m._id);

    // Fetch sentiment timelines for these meetings
    const timelines = await SentimentTimeline.find({
      $or: [
        { meeting: { $in: meetingIds } },
        { organization: organizationId, updatedAt: { $gte: sinceDate } },
      ],
      status: "completed",
    })
      .populate("meeting", "_id title date duration tags")
      .sort({ updatedAt: 1 })
      .lean();

    // Aggregate statistics
    let totalScoreSum = 0;
    let totalSegmentsCount = 0;
    let positiveSegmentsCount = 0;
    let neutralSegmentsCount = 0;
    let negativeSegmentsCount = 0;

    const meetingTrends = [];

    timelines.forEach((tl) => {
      const meetingObj =
        (tl.meeting && typeof tl.meeting === "object" ? tl.meeting : null) ||
        meetingMap.get(tl.meeting?.toString());
      const segments = tl.segments || [];
      if (segments.length === 0) return;

      let mScoreSum = 0;
      let mPos = 0;
      let mNeut = 0;
      let mNeg = 0;

      segments.forEach((seg) => {
        const score = typeof seg.score === "number" ? seg.score : 0;
        mScoreSum += score;
        totalScoreSum += score;
        totalSegmentsCount += 1;

        if (seg.sentiment === "positive" || score > 0.2) {
          mPos += 1;
          positiveSegmentsCount += 1;
        } else if (seg.sentiment === "negative" || score < -0.2) {
          mNeg += 1;
          negativeSegmentsCount += 1;
        } else {
          mNeut += 1;
          neutralSegmentsCount += 1;
        }
      });

      const avgScore = Number((mScoreSum / segments.length).toFixed(2));
      meetingTrends.push({
        timelineId: tl._id,
        meetingId: meetingObj?._id || tl.meeting,
        title: meetingObj?.title || "Meeting",
        date: meetingObj?.date || tl.createdAt,
        duration: meetingObj?.duration || 0,
        averageScore: avgScore,
        positiveCount: mPos,
        neutralCount: mNeut,
        negativeCount: mNeg,
        totalSegments: segments.length,
        overallArc: tl.overallArc || "",
        tags: meetingObj?.tags || [],
      });
    });

    const averageScore =
      totalSegmentsCount > 0
        ? Number((totalScoreSum / totalSegmentsCount).toFixed(2))
        : 0;

    const positivePercent =
      totalSegmentsCount > 0
        ? Math.round((positiveSegmentsCount / totalSegmentsCount) * 100)
        : 0;
    const neutralPercent =
      totalSegmentsCount > 0
        ? Math.round((neutralSegmentsCount / totalSegmentsCount) * 100)
        : 0;
    const negativePercent =
      totalSegmentsCount > 0
        ? Math.round((negativeSegmentsCount / totalSegmentsCount) * 100)
        : 0;

    // Determine trend direction
    let trendDirection = "stable";
    if (meetingTrends.length >= 2) {
      const half = Math.floor(meetingTrends.length / 2);
      const firstHalfAvg =
        meetingTrends
          .slice(0, half)
          .reduce((sum, m) => sum + m.averageScore, 0) / half;
      const secondHalfAvg =
        meetingTrends.slice(half).reduce((sum, m) => sum + m.averageScore, 0) /
        (meetingTrends.length - half);

      if (secondHalfAvg - firstHalfAvg > 0.15) {
        trendDirection = "improving";
      } else if (firstHalfAvg - secondHalfAvg > 0.15) {
        trendDirection = "declining";
      }
    }

    const sortedByScore = [...meetingTrends].sort(
      (a, b) => b.averageScore - a.averageScore,
    );
    const mostPositive = sortedByScore[0] || null;
    const mostNegative =
      sortedByScore.length > 1 ? sortedByScore[sortedByScore.length - 1] : null;

    return res.status(200).json({
      success: true,
      data: {
        organizationId,
        days: daysNum,
        summary: {
          averageScore,
          totalMeetingsAnalyzed: meetingTrends.length,
          totalSegmentsAnalyzed: totalSegmentsCount,
          positivePercent,
          neutralPercent,
          negativePercent,
          trendDirection,
        },
        timeline: meetingTrends,
        highlights: {
          mostPositiveMeeting: mostPositive,
          mostNegativeMeeting: mostNegative,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching organization sentiment trends:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch organization sentiment trends",
      error: error.message,
    });
  }
};
