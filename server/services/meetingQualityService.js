import MeetingQualityScore from "../models/MeetingQualityScore.js";
import QualityBenchmark from "../models/QualityBenchmark.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
import MeetingFeedback from "../models/meetingFeedbackModel.js";

/**
 * Meeting Quality Service
 * Core scoring engine that calculates multi-dimensional quality scores,
 * generates insights, awards badges, and updates benchmarks
 */

// Scoring weights for each dimension
const SCORE_WEIGHTS = {
  participation: 0.25,
  decision: 0.2,
  efficiency: 0.2,
  followThrough: 0.2,
  satisfaction: 0.15,
};

// Badge definitions with criteria
const BADGE_DEFINITIONS = {
  "Excellent Meeting": {
    icon: "🌟",
    criteria: (scores) => scores.overall >= 85,
    rarity: "uncommon",
    description: "Achieved an overall quality score of 85 or higher",
  },
  "Perfect Score": {
    icon: "💎",
    criteria: (scores) => scores.overall >= 95,
    rarity: "legendary",
    description: "Achieved a near-perfect quality score of 95+",
  },
  "Decision Maker": {
    icon: "⚖️",
    criteria: (scores) => scores.decision >= 90,
    rarity: "rare",
    description: "Exceptional decision-making quality",
  },
  "Efficiency Expert": {
    icon: "⚡",
    criteria: (scores) => scores.efficiency >= 90,
    rarity: "rare",
    description: "Outstanding meeting efficiency",
  },
  "Team Player": {
    icon: "🤝",
    criteria: (scores) => scores.participation >= 90,
    rarity: "rare",
    description: "Excellent participation equity",
  },
  "Follow-Through Champion": {
    icon: "✅",
    criteria: (scores) => scores.followThrough >= 90,
    rarity: "rare",
    description: "Exceptional action item completion",
  },
  "Engagement Leader": {
    icon: "🎯",
    criteria: (scores) => scores.satisfaction >= 90,
    rarity: "uncommon",
    description: "High participant satisfaction",
  },
  "Top Performer": {
    icon: "🏆",
    criteria: (scores, benchmark) => benchmark?.overallPercentile >= 90,
    rarity: "epic",
    description: "Top 10% of meetings in organization",
  },
};

/**
 * Calculate meeting quality score
 * @param {String} meetingId - Meeting ID
 * @returns {Object} Calculated quality score
 */
export const calculateMeetingQuality = async (meetingId) => {
  try {
    console.log(`🔍 Calculating quality for meeting ${meetingId}`);

    const meeting = await Meeting.findById(meetingId)
      .populate("participants", "name email")
      .populate("uploadedBy", "name email");

    if (!meeting) {
      throw new Error("Meeting not found");
    }

    // Initialize or update score document
    let scoreDoc = await MeetingQualityScore.findOne({ meeting: meetingId });
    if (!scoreDoc) {
      scoreDoc = new MeetingQualityScore({
        meeting: meetingId,
        organization: meeting.organization,
        meetingType: meeting.meetingType || "conference",
        status: "calculating",
      });
    } else {
      scoreDoc.status = "calculating";
      scoreDoc.recalculationCount += 1;
    }

    // Gather metrics
    const metrics = await gatherMeetingMetrics(meeting);

    // Calculate dimension scores
    const scores = calculateDimensionScores(metrics);

    // Calculate overall score
    scores.overall = calculateOverallScore(scores);

    // Generate insights
    const insights = generateInsights(scores, metrics, meeting);

    // Generate recommendations
    const recommendations = generateRecommendations(scores, insights);

    // Award badges
    const badges = await awardBadges(scores, meeting, meetingId);

    // Calculate benchmark comparison
    const benchmarkComparison = await calculateBenchmarkComparison(
      scores.overall,
      meeting.organization,
      meeting.meetingType,
    );

    // Update score document
    scoreDoc.scores = scores;
    scoreDoc.metrics = metrics;
    scoreDoc.insights = insights;
    scoreDoc.recommendations = recommendations;
    scoreDoc.badges = badges;
    scoreDoc.benchmarkComparison = benchmarkComparison;
    scoreDoc.calculatedAt = new Date();
    scoreDoc.status = "completed";
    scoreDoc.error = null;

    await scoreDoc.save();

    // Update benchmarks asynchronously
    updateBenchmarks(meeting.organization, meeting.meetingType).catch((err) =>
      console.error("Benchmark update error:", err),
    );

    console.log(`✅ Quality calculated: ${scores.overall.toFixed(1)}/100`);
    return scoreDoc;
  } catch (error) {
    console.error("Error calculating meeting quality:", error);

    // Update status to failed
    const scoreDoc = await MeetingQualityScore.findOne({ meeting: meetingId });
    if (scoreDoc) {
      scoreDoc.status = "failed";
      scoreDoc.error = error.message;
      await scoreDoc.save();
    }

    throw error;
  }
};

/**
 * Gather all metrics for a meeting
 */
const gatherMeetingMetrics = async (meeting) => {
  const metrics = {
    participantCount: meeting.participants?.length || 0,
    duration: meeting.duration || 0,
    decisionCount: 0,
    actionItemCount: 0,
    actionItemCompletionRate: 0,
    silencePeriods: 0,
    participationEquity: 0,
    avgInterventionLength: 0,
    speakerCount: 0,
    agendaItemsCovered: 0,
    offTopicTime: 0,
  };

  // Count decisions
  try {
    metrics.decisionCount = await Decision.countDocuments({
      sourceMeetingId: meeting._id,
    });
  } catch (error) {
    console.warn("Error counting decisions:", error.message);
  }

  // Count action items and completion rate
  try {
    const actionItems = await ActionItem.find({
      sourceMeetingId: meeting._id,
    });
    metrics.actionItemCount = actionItems.length;

    if (actionItems.length > 0) {
      const completed = actionItems.filter(
        (ai) => ai.status === "resolved" || ai.status === "completed",
      ).length;
      metrics.actionItemCompletionRate = (completed / actionItems.length) * 100;
    }
  } catch (error) {
    console.warn("Error counting action items:", error.message);
  }

  // Get feedback if available
  try {
    const feedback = await MeetingFeedback.findOne({ meeting: meeting._id });
    if (feedback && feedback.ratings) {
      metrics.avgSatisfaction = feedback.ratings.overall || 0;
    }
  } catch (err) {
    // Feedback model might not exist
  }

  // Get analytics if available (from MeetingAnalytics collection)
  try {
    const MeetingAnalytics = (await import("../models/MeetingAnalytics.js"))
      .default;
    const analytics = await MeetingAnalytics.findOne({ meeting: meeting._id });

    if (analytics) {
      metrics.silencePeriods = analytics.metrics?.silencePeriods || 0;
      metrics.participationEquity = analytics.metrics?.participationEquity || 0;
      metrics.avgInterventionLength =
        analytics.metrics?.averageInterventionLength || 0;
      metrics.speakerCount = analytics.metrics?.speakerCount || 0;
    }
  } catch (err) {
    // Analytics might not exist
  }

  // Estimate agenda coverage
  if (meeting.agendaItems && meeting.agendaItems.length > 0) {
    metrics.agendaItemsCovered = meeting.agendaItems.length;
  }

  return metrics;
};

/**
 * Calculate scores for each dimension
 */
const calculateDimensionScores = (metrics) => {
  const scores = {};

  // Participation Score (0-100)
  // Based on equity, speaker count vs participant count
  const equityScore = metrics.participationEquity || 50;
  const speakerRatio =
    metrics.participantCount > 0
      ? (metrics.speakerCount / metrics.participantCount) * 100
      : 0;
  scores.participation = Math.min(100, equityScore * 0.7 + speakerRatio * 0.3);

  // Decision Score (0-100)
  // Based on decision density (decisions per hour)
  const durationHours = metrics.duration / 60 || 1;
  const decisionDensity = metrics.decisionCount / durationHours;
  scores.decision = Math.min(100, decisionDensity * 20); // 5 decisions/hour = 100

  // Efficiency Score (0-100)
  // Based on duration, agenda coverage, off-topic time
  const idealDuration = 45; // minutes
  const durationPenalty =
    metrics.duration > idealDuration
      ? Math.min(30, (metrics.duration - idealDuration) / 2)
      : 0;

  let efficiencyBase = 80;
  if (metrics.agendaItemsCovered > 0) {
    efficiencyBase += 10;
  }
  if (metrics.offTopicTime > 10) {
    efficiencyBase -= Math.min(20, metrics.offTopicTime / 2);
  }

  scores.efficiency = Math.max(
    0,
    Math.min(100, efficiencyBase - durationPenalty),
  );

  // Follow-through Score (0-100)
  // Based on action item completion rate
  scores.followThrough = metrics.actionItemCompletionRate || 0;

  // Satisfaction Score (0-100)
  // Based on feedback ratings if available
  scores.satisfaction = metrics.avgSatisfaction || 70; // Default 70 if no feedback

  // Ensure all scores are within bounds
  Object.keys(scores).forEach((key) => {
    scores[key] = Math.max(0, Math.min(100, Math.round(scores[key] * 10) / 10));
  });

  return scores;
};

/**
 * Calculate weighted overall score
 */
const calculateOverallScore = (scores) => {
  let weighted = 0;
  Object.entries(SCORE_WEIGHTS).forEach(([dimension, weight]) => {
    weighted += (scores[dimension] || 0) * weight;
  });
  return Math.round(weighted * 10) / 10;
};

/**
 * Generate AI-powered insights based on scores and metrics
 */
const generateInsights = (scores, metrics, _meeting) => {
  const insights = [];

  // Participation insights
  if (scores.participation >= 85) {
    insights.push({
      type: "strength",
      category: "participation",
      message: `Excellent participation equity at ${scores.participation.toFixed(1)}%. All participants are actively engaged.`,
      impact: "medium",
      actionable: false,
      relatedMetric: "participation",
    });
  } else if (scores.participation < 50) {
    insights.push({
      type: "weakness",
      category: "participation",
      message: `Low participation score (${scores.participation.toFixed(1)}%). Consider encouraging quieter participants to contribute.`,
      impact: "high",
      actionable: true,
      relatedMetric: "participation",
    });
  }

  // Decision insights
  if (scores.decision >= 85) {
    insights.push({
      type: "strength",
      category: "decision-making",
      message: `High decision density with ${metrics.decisionCount} decisions in this meeting.`,
      impact: "medium",
      actionable: false,
      relatedMetric: "decisionCount",
    });
  } else if (scores.decision < 40 && metrics.duration > 30) {
    insights.push({
      type: "weakness",
      category: "decision-making",
      message: `Low decision density. Meeting may lack focus or clear objectives.`,
      impact: "high",
      actionable: true,
      relatedMetric: "decision",
    });
  }

  // Efficiency insights
  if (scores.efficiency >= 85) {
    insights.push({
      type: "strength",
      category: "efficiency",
      message: `Meeting was highly efficient with good time management.`,
      impact: "medium",
      actionable: false,
      relatedMetric: "efficiency",
    });
  } else if (scores.efficiency < 50) {
    insights.push({
      type: "weakness",
      category: "efficiency",
      message: `Meeting efficiency could be improved. Consider shorter meetings or better agenda preparation.`,
      impact: "high",
      actionable: true,
      relatedMetric: "efficiency",
    });
  }

  // Follow-through insights
  if (scores.followThrough >= 90) {
    insights.push({
      type: "strength",
      category: "follow-through",
      message: `Excellent follow-through with ${scores.followThrough.toFixed(1)}% action item completion rate.`,
      impact: "high",
      actionable: false,
      relatedMetric: "followThrough",
    });
  } else if (scores.followThrough < 50 && metrics.actionItemCount > 0) {
    insights.push({
      type: "weakness",
      category: "follow-through",
      message: `Low action item completion rate (${scores.followThrough.toFixed(1)}%). Consider better tracking and reminders.`,
      impact: "high",
      actionable: true,
      relatedMetric: "followThrough",
    });
  }

  // Satisfaction insights
  if (scores.satisfaction >= 85) {
    insights.push({
      type: "strength",
      category: "satisfaction",
      message: `High participant satisfaction score of ${scores.satisfaction.toFixed(1)}%.`,
      impact: "medium",
      actionable: false,
      relatedMetric: "satisfaction",
    });
  } else if (scores.satisfaction < 60) {
    insights.push({
      type: "weakness",
      category: "satisfaction",
      message: `Participant satisfaction could be improved. Consider gathering feedback to identify issues.`,
      impact: "medium",
      actionable: true,
      relatedMetric: "satisfaction",
    });
  }

  // Duration anomaly detection
  if (metrics.duration > 120) {
    insights.push({
      type: "anomaly",
      category: "efficiency",
      message: `Meeting duration (${metrics.duration} min) is significantly longer than average. Consider breaking into shorter sessions.`,
      impact: "medium",
      actionable: true,
      relatedMetric: "duration",
    });
  }

  // Recommendations based on weaknesses
  const weaknesses = insights.filter((i) => i.type === "weakness");
  if (weaknesses.length === 0 && scores.overall >= 80) {
    insights.push({
      type: "observation",
      category: "engagement",
      message: `This meeting demonstrates best practices across all quality dimensions. Consider using as a model for other meetings.`,
      impact: "low",
      actionable: false,
    });
  }

  return insights;
};

/**
 * Generate actionable recommendations
 */
const generateRecommendations = (scores, _insights) => {
  const recommendations = [];

  if (scores.participation < 60) {
    recommendations.push(
      "Use round-robin format to ensure all participants contribute",
    );
    recommendations.push(
      "Assign a facilitator to encourage quieter team members",
    );
  }

  if (scores.decision < 60) {
    recommendations.push(
      "Prepare clear decision points in the agenda before the meeting",
    );
    recommendations.push(
      "Use decision-making frameworks like RACI for complex topics",
    );
  }

  if (scores.efficiency < 60) {
    recommendations.push(
      "Limit meetings to 45 minutes and enforce time boundaries",
    );
    recommendations.push(
      "Share pre-read materials 24 hours before the meeting",
    );
    recommendations.push(
      "Start and end on time, even if not all agenda items are covered",
    );
  }

  if (scores.followThrough < 60) {
    recommendations.push(
      "Assign clear owners and deadlines for every action item",
    );
    recommendations.push(
      "Schedule follow-up check-ins for critical action items",
    );
    recommendations.push("Use automated reminders to track progress");
  }

  if (scores.satisfaction < 60) {
    recommendations.push("Send post-meeting feedback surveys to gather input");
    recommendations.push(
      "Review meeting necessity - could this be an email instead?",
    );
  }

  // General best practices
  if (scores.overall >= 80) {
    recommendations.push(
      "Document and share best practices from this meeting with other teams",
    );
  }

  return recommendations;
};

/**
 * Award badges based on scores and benchmarks
 */
const awardBadges = async (scores, meeting, _meetingId) => {
  const badges = [];

  // Check each badge definition
  for (const [badgeName, definition] of Object.entries(BADGE_DEFINITIONS)) {
    try {
      const benchmark = await calculateBenchmarkComparison(
        scores.overall,
        meeting.organization,
        meeting.meetingType,
      );

      if (definition.criteria(scores, benchmark)) {
        badges.push({
          name: badgeName,
          icon: definition.icon,
          description: definition.description,
          rarity: definition.rarity,
          earnedAt: new Date(),
        });
      }
    } catch (err) {
      console.warn(`Error checking badge ${badgeName}:`, err.message);
    }
  }

  return badges;
};

/**
 * Calculate benchmark comparison for a score
 */
const calculateBenchmarkComparison = async (
  overallScore,
  organizationId,
  meetingType,
) => {
  try {
    // Get organization benchmark
    const orgBenchmark = await QualityBenchmark.getOrganizationBenchmark(
      organizationId,
      "monthly",
    );

    // Get meeting type benchmark
    const typeBenchmark = await QualityBenchmark.getTypeBenchmark(
      organizationId,
      meetingType,
      "monthly",
    );

    const comparison = {
      overallPercentile: 50,
      categoryRanking: 0,
      vsOrgAverage: 0,
      vsTypeAverage: 0,
    };

    if (orgBenchmark) {
      // Calculate percentile
      const percentiles = orgBenchmark.percentiles || {};
      if (overallScore >= (percentiles.p90 || 0)) {
        comparison.overallPercentile = 90;
      } else if (overallScore >= (percentiles.p75 || 0)) {
        comparison.overallPercentile = 75;
      } else if (overallScore >= (percentiles.p50 || 0)) {
        comparison.overallPercentile = 50;
      } else if (overallScore >= (percentiles.p25 || 0)) {
        comparison.overallPercentile = 25;
      } else {
        comparison.overallPercentile = 10;
      }

      // Compare to org average
      comparison.vsOrgAverage =
        overallScore - (orgBenchmark.averages?.overall || 0);
    }

    if (typeBenchmark) {
      comparison.vsTypeAverage =
        overallScore - (typeBenchmark.averages?.overall || 0);
    }

    return comparison;
  } catch (error) {
    console.warn("Error calculating benchmark comparison:", error.message);
    return {
      overallPercentile: 50,
      categoryRanking: 0,
      vsOrgAverage: 0,
      vsTypeAverage: 0,
    };
  }
};

/**
 * Update benchmarks for organization and meeting type
 */
const updateBenchmarks = async (organizationId, meetingType) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get all scores for this month
    const scores = await MeetingQualityScore.find({
      organization: organizationId,
      calculatedAt: { $gte: monthStart, $lte: monthEnd },
      status: "completed",
    });

    if (scores.length === 0) return;

    // Update organization benchmark
    await updateBenchmarkDocument(
      organizationId,
      "organization",
      null,
      "monthly",
      monthStart,
      monthEnd,
      scores,
    );

    // Update meeting type benchmark
    const typeScores = scores.filter((s) => s.meetingType === meetingType);
    if (typeScores.length > 0) {
      await updateBenchmarkDocument(
        organizationId,
        "meeting-type",
        null,
        "monthly",
        monthStart,
        monthEnd,
        typeScores,
        meetingType,
      );
    }

    console.log(`✅ Updated benchmarks for org ${organizationId}`);
  } catch (error) {
    console.error("Error updating benchmarks:", error);
  }
};

/**
 * Update or create a benchmark document
 */
const updateBenchmarkDocument = async (
  orgId,
  type,
  entity,
  period,
  periodStart,
  periodEnd,
  scores,
  entityType = null,
) => {
  try {
    // Calculate averages
    const averages = {
      participation: 0,
      decision: 0,
      efficiency: 0,
      followThrough: 0,
      satisfaction: 0,
      overall: 0,
    };

    scores.forEach((score) => {
      averages.participation += score.scores?.participation || 0;
      averages.decision += score.scores?.decision || 0;
      averages.efficiency += score.scores?.efficiency || 0;
      averages.followThrough += score.scores?.followThrough || 0;
      averages.satisfaction += score.scores?.satisfaction || 0;
      averages.overall += score.scores?.overall || 0;
    });

    Object.keys(averages).forEach((key) => {
      averages[key] = Math.round((averages[key] / scores.length) * 10) / 10;
    });

    // Calculate percentiles
    const overallScores = scores
      .map((s) => s.scores?.overall || 0)
      .sort((a, b) => a - b);
    const percentiles = {
      p10: calculatePercentile(overallScores, 10),
      p25: calculatePercentile(overallScores, 25),
      p50: calculatePercentile(overallScores, 50),
      p75: calculatePercentile(overallScores, 75),
      p90: calculatePercentile(overallScores, 90),
      p95: calculatePercentile(overallScores, 95),
    };

    // Calculate standard deviations
    const stdDev = calculateStandardDeviations(scores);

    // Find top performers
    const topPerformers = scores
      .sort((a, b) => (b.scores?.overall || 0) - (a.scores?.overall || 0))
      .slice(0, 5)
      .map((s, idx) => ({
        entityId: s.meeting,
        entityName: `Meeting ${idx + 1}`,
        score: s.scores?.overall || 0,
        rank: idx + 1,
      }));

    // Calculate trend
    const previousBenchmark = await QualityBenchmark.findOne({
      organization: orgId,
      type,
      entity,
      entityType,
      period,
      periodEnd: { $lt: periodStart },
    }).sort({ periodEnd: -1 });

    const trends = {
      direction: "stable",
      changePercentage: 0,
      previousPeriodAverage: previousBenchmark?.averages?.overall || 0,
    };

    if (previousBenchmark) {
      const change = averages.overall - previousBenchmark.averages.overall;
      trends.changePercentage =
        previousBenchmark.averages.overall > 0
          ? (change / previousBenchmark.averages.overall) * 100
          : 0;

      if (change > 2) trends.direction = "improving";
      else if (change < -2) trends.direction = "declining";
    }

    // Upsert benchmark
    await QualityBenchmark.findOneAndUpdate(
      {
        organization: orgId,
        type,
        entity,
        entityType,
        period,
        periodStart,
        periodEnd,
      },
      {
        organization: orgId,
        type,
        entity,
        entityType,
        period,
        periodStart,
        periodEnd,
        averages,
        percentiles,
        stdDev,
        sampleSize: scores.length,
        topPerformers,
        trends,
        updatedAt: new Date(),
        isActive: true,
      },
      { upsert: true, new: true },
    );
  } catch (error) {
    console.error("Error updating benchmark document:", error);
  }
};

/**
 * Calculate percentile value
 */
const calculatePercentile = (sortedArray, percentile) => {
  if (sortedArray.length === 0) return 0;
  const index = (percentile / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sortedArray[lower];

  const weight = index - lower;
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
};

/**
 * Calculate standard deviations for all dimensions
 */
const calculateStandardDeviations = (scores) => {
  const stdDev = {};
  const dimensions = [
    "participation",
    "decision",
    "efficiency",
    "followThrough",
    "satisfaction",
    "overall",
  ];

  dimensions.forEach((dim) => {
    const values = scores.map((s) => s.scores?.[dim] || 0);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    stdDev[dim] = Math.round(Math.sqrt(variance) * 10) / 10;
  });

  return stdDev;
};

/**
 * Get meeting quality data
 */
export const getMeetingQuality = async (meetingId) => {
  try {
    const score = await MeetingQualityScore.findOne({ meeting: meetingId })
      .populate("meeting", "title date meetingType participants")
      .populate("organization", "name");

    return score;
  } catch (error) {
    console.error("Error getting meeting quality:", error);
    throw error;
  }
};

/**
 * Get organization quality metrics
 */
export const getOrganizationQuality = async (orgId, period = "monthly") => {
  try {
    const benchmark = await QualityBenchmark.getOrganizationBenchmark(
      orgId,
      period,
    );

    const scores = await MeetingQualityScore.find({
      organization: orgId,
      status: "completed",
    })
      .sort({ calculatedAt: -1 })
      .limit(50);

    return {
      benchmark,
      recentScores: scores,
      totalMeetings: scores.length,
      averageScore:
        scores.length > 0
          ? scores.reduce((sum, s) => sum + (s.scores?.overall || 0), 0) /
            scores.length
          : 0,
    };
  } catch (error) {
    console.error("Error getting organization quality:", error);
    throw error;
  }
};

/**
 * Get quality trends over time
 */
export const getQualityTrends = async (orgId, period = "weekly") => {
  try {
    const scores = await MeetingQualityScore.find({
      organization: orgId,
      status: "completed",
    })
      .sort({ calculatedAt: 1 })
      .limit(100);

    // Group by period
    const periodMap = new Map();
    scores.forEach((score) => {
      const date = new Date(score.calculatedAt);
      let periodKey;

      if (period === "daily") {
        periodKey = date.toISOString().split("T")[0];
      } else if (period === "weekly") {
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        periodKey = weekStart.toISOString().split("T")[0];
      } else if (period === "monthly") {
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }

      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, []);
      }
      periodMap.get(periodKey).push(score);
    });

    const trends = Array.from(periodMap.entries()).map(
      ([periodKey, periodScores]) => {
        const avg =
          periodScores.reduce((sum, s) => sum + (s.scores?.overall || 0), 0) /
          periodScores.length;
        return {
          period: periodKey,
          meetingCount: periodScores.length,
          averageScore: Math.round(avg * 10) / 10,
          minScore: Math.min(
            ...periodScores.map((s) => s.scores?.overall || 0),
          ),
          maxScore: Math.max(
            ...periodScores.map((s) => s.scores?.overall || 0),
          ),
        };
      },
    );

    return trends;
  } catch (error) {
    console.error("Error getting quality trends:", error);
    throw error;
  }
};

/**
 * Get leaderboard data
 */
export const getLeaderboard = async (orgId, period = "monthly") => {
  try {
    const benchmark = await QualityBenchmark.getOrganizationBenchmark(
      orgId,
      period,
    );

    // Get top meetings
    const topMeetings = await MeetingQualityScore.find({
      organization: orgId,
      status: "completed",
    })
      .populate("meeting", "title date uploadedBy")
      .sort({ "scores.overall": -1 })
      .limit(10);

    // Get top uploaders
    const uploaderStats = {};
    const allScores = await MeetingQualityScore.find({
      organization: orgId,
      status: "completed",
    }).populate("meeting", "uploadedBy");

    allScores.forEach((score) => {
      const uploaderId = score.meeting?.uploadedBy?.toString();
      if (!uploaderId) return;

      if (!uploaderStats[uploaderId]) {
        uploaderStats[uploaderId] = {
          userId: uploaderId,
          meetingCount: 0,
          totalScore: 0,
          badges: [],
        };
      }

      uploaderStats[uploaderId].meetingCount++;
      uploaderStats[uploaderId].totalScore += score.scores?.overall || 0;
      uploaderStats[uploaderId].badges.push(...(score.badges || []));
    });

    const topUploaders = Object.values(uploaderStats)
      .map((stat) => ({
        ...stat,
        averageScore:
          Math.round((stat.totalScore / stat.meetingCount) * 10) / 10,
        badgeCount: stat.badges.length,
      }))
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10);

    return {
      topMeetings,
      topUploaders,
      benchmark,
    };
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    throw error;
  }
};

/**
 * Export quality report
 */
export const exportQualityReport = async (orgId, _format = "json") => {
  try {
    const benchmark = await QualityBenchmark.getOrganizationBenchmark(
      orgId,
      "monthly",
    );
    const scores = await MeetingQualityScore.find({
      organization: orgId,
      status: "completed",
    })
      .populate("meeting", "title date meetingType")
      .sort({ calculatedAt: -1 })
      .limit(1000);

    const report = {
      organization: orgId,
      generatedAt: new Date(),
      benchmark,
      totalMeetings: scores.length,
      averageScore:
        scores.length > 0
          ? scores.reduce((sum, s) => sum + (s.scores?.overall || 0), 0) /
            scores.length
          : 0,
      meetings: scores.map((s) => ({
        meetingId: s.meeting?._id,
        title: s.meeting?.title,
        date: s.meeting?.date,
        type: s.meetingType,
        scores: s.scores,
        qualityTier: s.qualityTier,
        badges: s.badges,
        insights: s.insights,
        calculatedAt: s.calculatedAt,
      })),
    };

    return report;
  } catch (error) {
    console.error("Error exporting quality report:", error);
    throw error;
  }
};

export default {
  calculateMeetingQuality,
  getMeetingQuality,
  getOrganizationQuality,
  getQualityTrends,
  getLeaderboard,
  exportQualityReport,
};
