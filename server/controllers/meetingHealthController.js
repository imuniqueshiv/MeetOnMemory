import MeetingHealth from "../models/meetingHealthModel.js";
import { calculateMeetingHealth } from "../services/meetingHealthService.js";

// @desc    Get health score for a meeting
// @route   GET /api/meeting-health/:meetingId
// @access  Private
export const getMeetingHealth = async (req, res, next) => {
  try {
    const { meetingId } = req.params;

    // First try to find existing record
    let healthRecord = await MeetingHealth.findOne({ meetingId });

    // If not found, compute it on the fly
    if (!healthRecord) {
      healthRecord = await calculateMeetingHealth(meetingId);
    }

    res.status(200).json({
      success: true,
      data: healthRecord,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get organization health trends
// @route   GET /api/meeting-health/trends/:organizationId
// @access  Private
export const getOrganizationHealthTrends = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    // Get last 30 meetings health for trends
    const trends = await MeetingHealth.find({ organization: organizationId })
      .sort({ createdAt: 1 }) // Chronological order
      .limit(30)
      .populate("meetingId", "title date");

    if (!trends || trends.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          trends: [],
          benchmarks: null,
        },
      });
    }

    // Calculate benchmarks (averages across the fetched meetings)
    const totalMeetings = trends.length;
    let sumComposite = 0;
    let sumAgenda = 0;
    let sumTime = 0;
    let sumEngagement = 0;
    let sumActionItems = 0;
    let sumSentiment = 0;

    trends.forEach((t) => {
      sumComposite += t.compositeScore;
      sumAgenda += t.factors.agendaCoverage;
      sumTime += t.factors.timeAdherence;
      sumEngagement += t.factors.engagement;
      sumActionItems += t.factors.actionItemClarity;
      sumSentiment += t.factors.sentiment;
    });

    const benchmarks = {
      averageComposite: Math.round(sumComposite / totalMeetings),
      averageAgendaCoverage: Math.round(sumAgenda / totalMeetings),
      averageTimeAdherence: Math.round(sumTime / totalMeetings),
      averageEngagement: Math.round(sumEngagement / totalMeetings),
      averageActionItemClarity: Math.round(sumActionItems / totalMeetings),
      averageSentiment: Math.round(sumSentiment / totalMeetings),
    };

    res.status(200).json({
      success: true,
      data: {
        trends,
        benchmarks,
      },
    });
  } catch (error) {
    next(error);
  }
};
