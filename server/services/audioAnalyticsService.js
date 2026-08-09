import MeetingAnalytics from "../models/MeetingAnalytics.js";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import Transcript from "../models/transcriptModel.js";

/**
 * Audio Analytics Service
 * Provides comprehensive meeting analytics including speaker tracking,
 * participation metrics, and AI-powered insights
 */

// Configuration constants
const SILENCE_THRESHOLD = 5; // seconds
const MIN_INTERVENTION_LENGTH = 0.5; // seconds
const DOMINANCE_THRESHOLD = 40; // percentage

/**
 * Calculate participation equity using Gini coefficient
 * @param {Array} speakerTimes - Array of speaking times
 * @returns {Number} Equity score (0-100, higher is more equal)
 */
const calculateParticipationEquity = (speakerTimes) => {
  if (speakerTimes.length === 0) return 0;
  if (speakerTimes.length === 1) return 100;

  const sorted = [...speakerTimes].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((sum, val) => sum + val, 0);

  if (total === 0) return 100;

  let giniSum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      giniSum += Math.abs(sorted[i] - sorted[j]);
    }
  }

  const gini = giniSum / (2 * n * total);
  const equity = (1 - gini) * 100;

  return Math.max(0, Math.min(100, equity));
};

/**
 * Detect silence periods in timeline
 * @param {Array} timeline - Array of timeline entries
 * @param {Number} totalDuration - Total meeting duration
 * @returns {Array} Array of silence periods
 */
const detectSilencePeriods = (timeline, totalDuration) => {
  const silencePeriods = [];

  if (timeline.length === 0) {
    if (totalDuration > SILENCE_THRESHOLD) {
      silencePeriods.push({
        startTime: 0,
        endTime: totalDuration,
        duration: totalDuration,
      });
    }
    return silencePeriods;
  }

  // Sort timeline by timestamp
  const sorted = [...timeline].sort((a, b) => a.timestamp - b.timestamp);

  // Check for silence at the beginning
  if (sorted[0].timestamp > SILENCE_THRESHOLD) {
    silencePeriods.push({
      startTime: 0,
      endTime: sorted[0].timestamp,
      duration: sorted[0].timestamp,
    });
  }

  // Check for silence between speaking turns
  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = sorted[i].timestamp + sorted[i].duration;
    const nextStart = sorted[i + 1].timestamp;
    const gap = nextStart - currentEnd;

    if (gap > SILENCE_THRESHOLD) {
      silencePeriods.push({
        startTime: currentEnd,
        endTime: nextStart,
        duration: gap,
      });
    }
  }

  // Check for silence at the end
  const lastEntry = sorted[sorted.length - 1];
  const lastEnd = lastEntry.timestamp + lastEntry.duration;
  if (totalDuration - lastEnd > SILENCE_THRESHOLD) {
    silencePeriods.push({
      startTime: lastEnd,
      endTime: totalDuration,
      duration: totalDuration - lastEnd,
    });
  }

  return silencePeriods;
};

/**
 * Generate AI-powered insights based on analytics
 * @param {Object} analytics - Analytics data
 * @returns {Array} Array of insights
 */
const generateInsights = (analytics) => {
  const insights = [];
  const { speakers, metrics } = analytics;

  // Participation insights
  if (metrics.participationEquity < 50) {
    insights.push({
      type: "weakness",
      category: "participation",
      message: `Participation is uneven with an equity score of ${metrics.participationEquity.toFixed(1)}%. Consider encouraging quieter participants to contribute.`,
      impact: "high",
      actionable: true,
      relatedMetric: "participationEquity",
    });
  } else if (metrics.participationEquity > 80) {
    insights.push({
      type: "strength",
      category: "participation",
      message: `Excellent participation equity at ${metrics.participationEquity.toFixed(1)}%. All participants are actively engaged.`,
      impact: "medium",
      actionable: false,
      relatedMetric: "participationEquity",
    });
  }

  // Dominance insights
  const dominantSpeaker = speakers.reduce(
    (max, s) => (s.percentage > max.percentage ? s : max),
    { percentage: 0 },
  );

  if (dominantSpeaker.percentage > DOMINANCE_THRESHOLD) {
    insights.push({
      type: "weakness",
      category: "participation",
      message: `${dominantSpeaker.name} dominated ${dominantSpeaker.percentage.toFixed(1)}% of the conversation. Consider implementing structured turn-taking.`,
      impact: "high",
      actionable: true,
      relatedMetric: "dominanceScore",
    });
  }

  // Silence insights
  if (metrics.silencePeriods > 5) {
    insights.push({
      type: "weakness",
      category: "engagement",
      message: `Meeting had ${metrics.silencePeriods} significant silence periods totaling ${Math.round(metrics.totalSilenceTime / 60)} minutes. Consider preparing more engaging discussion topics.`,
      impact: "medium",
      actionable: true,
      relatedMetric: "silencePeriods",
    });
  }

  // Decision density insights
  if (metrics.decisionDensity < 2 && metrics.totalDuration > 3600) {
    insights.push({
      type: "weakness",
      category: "decision-making",
      message: `Low decision density (${metrics.decisionDensity.toFixed(1)} decisions/hour). Meeting may lack focus or clear objectives.`,
      impact: "high",
      actionable: true,
      relatedMetric: "decisionDensity",
    });
  } else if (metrics.decisionDensity > 5) {
    insights.push({
      type: "strength",
      category: "decision-making",
      message: `High decision density (${metrics.decisionDensity.toFixed(1)} decisions/hour) indicates productive and focused discussion.`,
      impact: "medium",
      actionable: false,
      relatedMetric: "decisionDensity",
    });
  }

  // Action item insights
  if (metrics.actionItemDensity < 1 && metrics.totalDuration > 3600) {
    insights.push({
      type: "weakness",
      category: "efficiency",
      message: `Low action item generation (${metrics.actionItemDensity.toFixed(1)} items/hour). Consider setting clearer meeting objectives.`,
      impact: "medium",
      actionable: true,
      relatedMetric: "actionItemDensity",
    });
  }

  // Engagement insights
  if (metrics.engagementScore < 50) {
    insights.push({
      type: "weakness",
      category: "engagement",
      message: `Overall engagement score is low (${metrics.engagementScore.toFixed(1)}). Consider shorter meetings or more interactive formats.`,
      impact: "high",
      actionable: true,
      relatedMetric: "engagementScore",
    });
  } else if (metrics.engagementScore > 80) {
    insights.push({
      type: "strength",
      category: "engagement",
      message: `High engagement score (${metrics.engagementScore.toFixed(1)}) indicates effective meeting facilitation.`,
      impact: "medium",
      actionable: false,
      relatedMetric: "engagementScore",
    });
  }

  // Intervention length insights
  if (metrics.averageInterventionLength > 120) {
    insights.push({
      type: "recommendation",
      category: "efficiency",
      message: `Average speaking turns are long (${Math.round(metrics.averageInterventionLength)}s). Consider encouraging more concise communication.`,
      impact: "medium",
      actionable: true,
      relatedMetric: "averageInterventionLength",
    });
  }

  return insights;
};

/**
 * Analyze meeting transcript and generate analytics
 * @param {String} meetingId - Meeting ID
 * @returns {Object} Analytics data
 */
export const analyzeMeeting = async (meetingId) => {
  try {
    // Fetch meeting and transcript
    const meeting = await Meeting.findById(meetingId).populate("participants");
    if (!meeting) {
      throw new Error("Meeting not found");
    }

    const transcript = await Transcript.findOne({ meeting: meetingId }).sort({
      timestamp: 1,
    });

    if (
      !transcript ||
      !transcript.segments ||
      transcript.segments.length === 0
    ) {
      throw new Error("No transcript data available for analysis");
    }

    // Initialize analytics document
    let analytics = await MeetingAnalytics.findOne({ meeting: meetingId });
    if (!analytics) {
      analytics = new MeetingAnalytics({
        meeting: meetingId,
        organization: meeting.organization,
        status: "analyzing",
      });
    } else {
      analytics.status = "analyzing";
    }

    // Process transcript segments into timeline
    const timeline = [];
    const speakerMap = new Map();

    for (const segment of transcript.segments) {
      if (!segment.speaker || segment.duration < MIN_INTERVENTION_LENGTH) {
        continue;
      }

      // Find or create speaker analytics
      const speakerId = segment.speaker.toString();
      if (!speakerMap.has(speakerId)) {
        const user = await User.findById(speakerId);
        speakerMap.set(speakerId, {
          userId: speakerId,
          name: user?.name || segment.speakerName || "Unknown",
          email: user?.email || "",
          totalTime: 0,
          interventionCount: 0,
          interventions: [],
          firstSpokeAt: segment.timestamp,
          lastSpokeAt: segment.timestamp,
        });
      }

      const speaker = speakerMap.get(speakerId);
      speaker.totalTime += segment.duration;
      speaker.interventionCount += 1;
      speaker.interventions.push(segment.duration);
      speaker.lastSpokeAt = segment.timestamp;

      // Add to timeline
      timeline.push({
        timestamp: segment.timestamp,
        speaker: speakerId,
        speakerName: speaker.name,
        duration: segment.duration,
        text: segment.text?.substring(0, 200) || "",
      });
    }

    // Calculate speaker metrics
    const totalDuration =
      transcript.segments[transcript.segments.length - 1]?.timestamp +
        transcript.segments[transcript.segments.length - 1]?.duration || 0;

    const speakers = Array.from(speakerMap.values()).map((speaker) => {
      const avgInterventionLength =
        speaker.interventionCount > 0
          ? speaker.totalTime / speaker.interventionCount
          : 0;

      const percentage =
        totalDuration > 0 ? (speaker.totalTime / totalDuration) * 100 : 0;

      return {
        userId: speaker.userId,
        name: speaker.name,
        email: speaker.email,
        totalTime: speaker.totalTime,
        interventionCount: speaker.interventionCount,
        averageInterventionLength: avgInterventionLength,
        percentage: percentage,
        dominanceScore: percentage,
        firstSpokeAt: speaker.firstSpokeAt,
        lastSpokeAt: speaker.lastSpokeAt,
      };
    });

    // Calculate metrics
    const speakerTimes = speakers.map((s) => s.totalTime);
    const participationEquity = calculateParticipationEquity(speakerTimes);

    const silencePeriods = detectSilencePeriods(timeline, totalDuration);
    const totalSilenceTime = silencePeriods.reduce(
      (sum, p) => sum + p.duration,
      0,
    );

    const allInterventions = speakers.flatMap((s) =>
      Array(s.interventionCount).fill(s.averageInterventionLength),
    );
    const averageInterventionLength =
      allInterventions.length > 0
        ? allInterventions.reduce((sum, val) => sum + val, 0) /
          allInterventions.length
        : 0;
    const longestIntervention = Math.max(...allInterventions, 0);

    // Count decisions and action items (would need integration with decision/action models)
    const decisionCount = 0; // Placeholder
    const actionItemCount = 0; // Placeholder

    const durationHours = totalDuration / 3600;
    const decisionDensity =
      durationHours > 0 ? decisionCount / durationHours : 0;
    const actionItemDensity =
      durationHours > 0 ? actionItemCount / durationHours : 0;

    // Calculate engagement score (weighted average of multiple factors)
    const engagementScore =
      participationEquity * 0.3 +
      Math.min(100, (speakers.length / meeting.participants.length) * 100) *
        0.3 +
      Math.min(100, (1 - totalSilenceTime / totalDuration) * 100) * 0.2 +
      Math.min(100, decisionDensity * 20) * 0.2;

    const metrics = {
      totalDuration,
      speakerCount: speakers.length,
      participantCount: meeting.participants.length,
      participationEquity,
      silencePeriods: silencePeriods.length,
      totalSilenceTime,
      averageInterventionLength,
      longestIntervention,
      decisionCount,
      decisionDensity,
      actionItemCount,
      actionItemDensity,
      engagementScore,
    };

    // Generate insights
    const insights = generateInsights({ speakers, metrics });

    // Update analytics document
    analytics.speakers = speakers;
    analytics.timeline = timeline;
    analytics.silencePeriods = silencePeriods;
    analytics.metrics = metrics;
    analytics.insights = insights;
    analytics.analyzedAt = new Date();
    analytics.status = "completed";
    analytics.error = null;

    await analytics.save();

    return analytics;
  } catch (error) {
    console.error("Error analyzing meeting:", error);

    // Update status to failed
    const analytics = await MeetingAnalytics.findOne({ meeting: meetingId });
    if (analytics) {
      analytics.status = "failed";
      analytics.error = error.message;
      await analytics.save();
    }

    throw error;
  }
};

/**
 * Get organization-wide analytics
 * @param {String} organizationId - Organization ID
 * @param {Object} filters - Optional filters
 * @returns {Object} Aggregated analytics
 */
export const getOrganizationAnalytics = async (
  organizationId,
  filters = {},
) => {
  try {
    const query = { organization: organizationId, status: "completed" };

    if (filters.startDate) {
      query.analyzedAt = { $gte: new Date(filters.startDate) };
    }

    if (filters.endDate) {
      query.analyzedAt = {
        ...query.analyzedAt,
        $lte: new Date(filters.endDate),
      };
    }

    const allAnalytics = await MeetingAnalytics.find(query)
      .populate("meeting", "title date meetingType")
      .sort({ analyzedAt: -1 });

    if (allAnalytics.length === 0) {
      return {
        meetingCount: 0,
        averageMetrics: {},
        trends: [],
        topPerformers: [],
      };
    }

    // Calculate averages
    const metrics = allAnalytics.map((a) => a.metrics);
    const averageMetrics = {
      totalDuration:
        metrics.reduce((sum, m) => sum + m.totalDuration, 0) / metrics.length,
      speakerCount:
        metrics.reduce((sum, m) => sum + m.speakerCount, 0) / metrics.length,
      participationEquity:
        metrics.reduce((sum, m) => sum + m.participationEquity, 0) /
        metrics.length,
      engagementScore:
        metrics.reduce((sum, m) => sum + m.engagementScore, 0) / metrics.length,
      decisionDensity:
        metrics.reduce((sum, m) => sum + m.decisionDensity, 0) / metrics.length,
      actionItemDensity:
        metrics.reduce((sum, m) => sum + m.actionItemDensity, 0) /
        metrics.length,
    };

    // Calculate trends (group by week)
    const trends = [];
    const weekMap = new Map();

    allAnalytics.forEach((analytics) => {
      const weekStart = new Date(analytics.analyzedAt);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().split("T")[0];

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey).push(analytics);
    });

    weekMap.forEach((weekAnalytics, weekKey) => {
      const weekMetrics = weekAnalytics.map((a) => a.metrics);
      trends.push({
        week: weekKey,
        meetingCount: weekAnalytics.length,
        avgEngagement:
          weekMetrics.reduce((sum, m) => sum + m.engagementScore, 0) /
          weekMetrics.length,
        avgParticipationEquity:
          weekMetrics.reduce((sum, m) => sum + m.participationEquity, 0) /
          weekMetrics.length,
      });
    });

    // Find top performers (most engaged speakers)
    const speakerStats = new Map();
    allAnalytics.forEach((analytics) => {
      analytics.speakers.forEach((speaker) => {
        const key = speaker.userId.toString();
        if (!speakerStats.has(key)) {
          speakerStats.set(key, {
            userId: speaker.userId,
            name: speaker.name,
            totalTime: 0,
            interventionCount: 0,
            meetingCount: 0,
          });
        }
        const stats = speakerStats.get(key);
        stats.totalTime += speaker.totalTime;
        stats.interventionCount += speaker.interventionCount;
        stats.meetingCount += 1;
      });
    });

    const topPerformers = Array.from(speakerStats.values())
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 10);

    return {
      meetingCount: allAnalytics.length,
      averageMetrics: averageMetrics,
      trends: trends.sort((a, b) => new Date(a.week) - new Date(b.week)),
      topPerformers,
    };
  } catch (error) {
    console.error("Error getting organization analytics:", error);
    throw error;
  }
};

export default {
  analyzeMeeting,
  getOrganizationAnalytics,
};
