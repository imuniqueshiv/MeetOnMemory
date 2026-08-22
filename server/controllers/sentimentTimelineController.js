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

// Aggregate organization-wide sentiment trends (#2039)
export const getOrgSentimentTrends = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { range = "30d" } = req.query;

    const userOrg = (
      req.user?.organization?._id || req.user?.organization
    )?.toString();
    if (!orgId || !mongoose.Types.ObjectId.isValid(orgId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid organization ID format" });
    }

    if (
      userOrg !== orgId &&
      req.user?.role !== "admin" &&
      req.user?.role !== "owner"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Forbidden: You don't have access to this organization's sentiment trends",
      });
    }

    const now = new Date();
    let days = 30;
    if (range === "7d") days = 7;
    else if (range === "90d") days = 90;
    else if (range === "all") days = 365;

    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const meetings = await Meeting.find({
      organization: orgId,
      createdAt: { $gte: cutoff },
    })
      .select("_id title createdAt uploadedBy")
      .lean();

    const meetingIds = meetings.map((m) => m._id);

    const timelines = await SentimentTimeline.find({
      meeting: { $in: meetingIds },
    }).lean();

    const timelineMap = new Map();
    timelines.forEach((t) => {
      timelineMap.set(t.meeting.toString(), t);
    });

    const meetingTrends = meetings.map((m) => {
      const tl = timelineMap.get(m._id.toString());
      const averageScore =
        tl?.averageScore ??
        (tl?.dataPoints?.length
          ? tl.dataPoints.reduce((acc, p) => acc + (p.sentimentScore || 0), 0) /
            tl.dataPoints.length
          : null);
      return {
        meetingId: m._id,
        title: m.title,
        date: m.createdAt,
        averageScore:
          averageScore !== null ? Number(averageScore.toFixed(2)) : null,
        hasSentiment: averageScore !== null,
        dataPointsCount: tl?.dataPoints?.length || 0,
      };
    });

    const meetingsWithSentiment = meetingTrends.filter((m) => m.hasSentiment);
    const overallAvgScore = meetingsWithSentiment.length
      ? Number(
          (
            meetingsWithSentiment.reduce((acc, m) => acc + m.averageScore, 0) /
            meetingsWithSentiment.length
          ).toFixed(2),
        )
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        organizationId: orgId,
        range,
        totalMeetings: meetings.length,
        analyzedMeetings: meetingsWithSentiment.length,
        overallAverageScore: overallAvgScore,
        trends: meetingTrends,
      },
    });
  } catch (error) {
    console.error("Error fetching org sentiment trends:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch organization sentiment trends",
      error: error.message,
    });
  }
};
