import MeetingQualityScore from "../models/MeetingQualityScore.js";
import QualityBenchmark from "../models/QualityBenchmark.js";
import Meeting from "../models/meetingModel.js";

/**
 * Recommendation Engine
 * Generates personalized, AI-powered recommendations based on
 * meeting quality patterns and best practices
 */

// Recommendation templates with conditions
const RECOMMENDATION_TEMPLATES = [
  {
    id: "participation-round-robin",
    category: "participation",
    condition: (scores, _metrics) =>
      scores.participation < 60 && _metrics.participantCount > 5,
    priority: "high",
    title: "Implement Round-Robin Participation",
    description:
      "Use a structured round-robin format to ensure all participants contribute equally.",
    actionItems: [
      "Assign 2 minutes per participant for initial input",
      "Use a talking stick or virtual equivalent",
      "Rotate speaking order each meeting",
    ],
    expectedImprovement: "+15-20 points in participation score",
    timeframe: "Immediate",
  },
  {
    id: "efficiency-time-boxing",
    category: "efficiency",
    condition: (scores, _metrics) =>
      scores.efficiency < 60 && _metrics.duration > 60,
    priority: "high",
    title: "Implement Strict Time-Boxing",
    description:
      "Limit meeting duration and enforce time boundaries for each agenda item.",
    actionItems: [
      "Set maximum meeting length to 45 minutes",
      "Allocate specific time slots for each agenda item",
      "Use a visible timer during discussions",
      "End meetings on time regardless of agenda completion",
    ],
    expectedImprovement: "+20-25 points in efficiency score",
    timeframe: "1-2 weeks",
  },
  {
    id: "decision-framework",
    category: "decision-making",
    condition: (scores, _metrics) =>
      scores.decision < 50 && _metrics.decisionCount < 3,
    priority: "high",
    title: "Adopt Decision-Making Framework",
    description:
      "Use structured frameworks like RACI or RAPID for complex decisions.",
    actionItems: [
      "Identify decision points in agenda beforehand",
      "Assign decision-making roles (RACI matrix)",
      "Document decisions with clear owners and deadlines",
      "Review previous decisions at start of follow-up meetings",
    ],
    expectedImprovement: "+25-30 points in decision score",
    timeframe: "2-4 weeks",
  },
  {
    id: "followthrough-tracking",
    category: "follow-through",
    condition: (scores, _metrics) =>
      scores.followThrough < 60 && _metrics.actionItemCount > 0,
    priority: "high",
    title: "Enhance Action Item Tracking",
    description:
      "Implement systematic tracking and follow-up for all action items.",
    actionItems: [
      "Assign clear owners and deadlines for every action item",
      "Use automated reminders 24h before deadlines",
      "Review action item status at start of each meeting",
      "Escalate overdue items to managers",
    ],
    expectedImprovement: "+30-40 points in follow-through score",
    timeframe: "2-4 weeks",
  },
  {
    id: "satisfaction-feedback",
    category: "satisfaction",
    condition: (scores, _metrics) => scores.satisfaction < 60,
    priority: "medium",
    title: "Implement Feedback Loops",
    description:
      "Gather and act on participant feedback to improve meeting quality.",
    actionItems: [
      "Send 2-minute feedback survey after each meeting",
      "Review feedback trends monthly",
      "Address top 3 concerns in next meeting",
      "Recognize improvements publicly",
    ],
    expectedImprovement: "+15-20 points in satisfaction score",
    timeframe: "1-2 weeks",
  },
  {
    id: "pre-meeting-prep",
    category: "efficiency",
    condition: (scores, _metrics) =>
      scores.efficiency < 70 && _metrics.duration > 45,
    priority: "medium",
    title: "Enhance Pre-Meeting Preparation",
    description: "Improve meeting efficiency through better preparation.",
    actionItems: [
      "Share agenda and pre-read materials 24h before meeting",
      "Require participants to review materials beforehand",
      "Start meetings with quick alignment check",
      "Cancel meetings if preparation not completed",
    ],
    expectedImprovement: "+10-15 points in efficiency score",
    timeframe: "1 week",
  },
  {
    id: "agenda-structure",
    category: "decision-making",
    condition: (scores, _metrics) => scores.decision < 60,
    priority: "medium",
    title: "Structure Agendas for Decisions",
    description: "Design agendas that drive clear decisions and outcomes.",
    actionItems: [
      "Start agenda with decision points, not updates",
      "Include 'decision required' flag for each item",
      "Allocate more time to complex decisions",
      "End with clear next steps and owners",
    ],
    expectedImprovement: "+15-20 points in decision score",
    timeframe: "1-2 weeks",
  },
  {
    id: "meeting-necessity",
    category: "efficiency",
    condition: (scores, _metrics) =>
      scores.overall < 50 && _metrics.duration > 30,
    priority: "high",
    title: "Question Meeting Necessity",
    description:
      "Evaluate whether meetings could be replaced with async communication.",
    actionItems: [
      "Ask 'Could this be an email?' before scheduling",
      "Use async tools for status updates",
      "Reserve meetings for complex discussions and decisions",
      "Cancel recurring meetings that lack clear purpose",
    ],
    expectedImprovement: "+20-30 points in overall quality",
    timeframe: "Immediate",
  },
  {
    id: "best-practice-sharing",
    category: "engagement",
    condition: (scores, _metrics) => scores.overall >= 85,
    priority: "low",
    title: "Share Best Practices",
    description: "Document and share what makes this meeting successful.",
    actionItems: [
      "Document meeting format and structure",
      "Share agenda template with other teams",
      "Create case study of successful outcomes",
      "Mentor other meeting organizers",
    ],
    expectedImprovement: "Organization-wide improvement",
    timeframe: "1-2 weeks",
  },
  {
    id: "continuous-improvement",
    category: "engagement",
    condition: (scores, _metrics) =>
      scores.overall >= 70 && scores.overall < 85,
    priority: "medium",
    title: "Continuous Improvement Plan",
    description:
      "Implement systematic approach to ongoing meeting quality improvement.",
    actionItems: [
      "Set quality score targets for next quarter",
      "Review quality trends monthly",
      "Experiment with one new technique per month",
      "Celebrate quality improvements publicly",
    ],
    expectedImprovement: "+5-10 points per quarter",
    timeframe: "Ongoing",
  },
];

/**
 * Generate personalized recommendations for a user
 * @param {String} userId - User ID
 * @param {String} orgId - Organization ID
 * @returns {Object} Personalized recommendations
 */
export const generateUserRecommendations = async (userId, orgId) => {
  try {
    // Get user's recent meetings
    const meetings = await Meeting.find({
      uploadedBy: userId,
      organization: orgId,
    })
      .sort({ date: -1 })
      .limit(20);

    if (meetings.length === 0) {
      return {
        recommendations: [],
        summary: "No meetings found to analyze",
        improvementAreas: [],
      };
    }

    // Get quality scores for these meetings
    const meetingIds = meetings.map((m) => m._id);
    const scores = await MeetingQualityScore.find({
      meeting: { $in: meetingIds },
      status: "completed",
    }).sort({ calculatedAt: -1 });

    if (scores.length === 0) {
      return {
        recommendations: [],
        summary: "Quality scores not yet calculated for your meetings",
        improvementAreas: [],
      };
    }

    // Calculate user's average scores
    const userAverages = calculateUserAverages(scores);

    // Get organization benchmark for comparison
    const orgBenchmark = await QualityBenchmark.getOrganizationBenchmark(
      orgId,
      "monthly",
    );

    // Identify improvement areas
    const improvementAreas = identifyImprovementAreas(
      userAverages,
      orgBenchmark,
    );

    // Generate recommendations based on patterns
    const recommendations = generatePatternBasedRecommendations(
      userAverages,
      scores,
      improvementAreas,
    );

    // Calculate improvement roadmap
    const roadmap = generateImprovementRoadmap(recommendations, userAverages);

    return {
      userAverages,
      orgBenchmark: orgBenchmark?.averages,
      recommendations: recommendations.slice(0, 5), // Top 5 recommendations
      improvementAreas,
      roadmap,
      meetingCount: scores.length,
      trendAnalysis: analyzeTrends(scores),
    };
  } catch (error) {
    console.error("Error generating user recommendations:", error);
    throw error;
  }
};

/**
 * Calculate user's average scores across dimensions
 */
const calculateUserAverages = (scores) => {
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

  return averages;
};

/**
 * Identify areas where user needs improvement
 */
const identifyImprovementAreas = (userAverages, orgBenchmark) => {
  const areas = [];
  const dimensions = [
    "participation",
    "decision",
    "efficiency",
    "followThrough",
    "satisfaction",
  ];

  dimensions.forEach((dim) => {
    const userScore = userAverages[dim];
    const orgScore = orgBenchmark?.[dim] || 70;
    const gap = orgScore - userScore;

    if (gap > 10) {
      areas.push({
        dimension: dim,
        userScore,
        orgScore,
        gap: Math.round(gap * 10) / 10,
        priority: gap > 20 ? "high" : "medium",
      });
    }
  });

  // Sort by gap size
  return areas.sort((a, b) => b.gap - a.gap);
};

/**
 * Generate recommendations based on patterns
 */
const generatePatternBasedRecommendations = (
  userAverages,
  scores,
  improvementAreas,
) => {
  const recommendations = [];

  // Check each recommendation template
  RECOMMENDATION_TEMPLATES.forEach((template) => {
    try {
      // Use average scores as metrics proxy
      const mockMetrics = {
        participantCount: 8,
        duration: 60,
        decisionCount: 3,
        actionItemCount: 5,
      };

      if (template.condition(userAverages, mockMetrics)) {
        recommendations.push({
          id: template.id,
          category: template.category,
          priority: template.priority,
          title: template.title,
          description: template.description,
          actionItems: template.actionItems,
          expectedImprovement: template.expectedImprovement,
          timeframe: template.timeframe,
          relevance: calculateRelevance(template, improvementAreas),
        });
      }
    } catch (err) {
      console.warn(`Error evaluating template ${template.id}:`, err.message);
    }
  });

  // Sort by priority and relevance
  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.relevance - a.relevance;
  });
};

/**
 * Calculate relevance score for a recommendation
 */
const calculateRelevance = (template, improvementAreas) => {
  const relevantArea = improvementAreas.find(
    (area) => area.dimension === template.category,
  );
  if (!relevantArea) return 50;

  // Higher gap = higher relevance
  return Math.min(100, relevantArea.gap * 3);
};

/**
 * Generate improvement roadmap
 */
const generateImprovementRoadmap = (recommendations, _userAverages) => {
  const roadmap = {
    immediate: [], // Next 1-2 weeks
    shortTerm: [], // Next month
    longTerm: [], // Next quarter
    estimatedImprovement: 0,
  };

  recommendations.forEach((rec) => {
    if (rec.timeframe === "Immediate") {
      roadmap.immediate.push(rec);
    } else if (rec.timeframe.includes("week")) {
      roadmap.shortTerm.push(rec);
    } else {
      roadmap.longTerm.push(rec);
    }

    // Parse expected improvement
    const match = rec.expectedImprovement.match(/\+(\d+)-(\d+)/);
    if (match) {
      const avgImprovement = (parseInt(match[1]) + parseInt(match[2])) / 2;
      roadmap.estimatedImprovement += avgImprovement;
    }
  });

  // Cap estimated improvement at reasonable level
  roadmap.estimatedImprovement = Math.min(30, roadmap.estimatedImprovement);

  return roadmap;
};

/**
 * Analyze trends in user's meeting quality
 */
const analyzeTrends = (scores) => {
  if (scores.length < 3) {
    return {
      direction: "insufficient-data",
      changePercentage: 0,
      message: "Need more meetings to analyze trends",
    };
  }

  // Sort by date
  const sorted = [...scores].sort(
    (a, b) => new Date(a.calculatedAt) - new Date(b.calculatedAt),
  );

  // Compare first half to second half
  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const firstHalfAvg =
    firstHalf.reduce((sum, s) => sum + (s.scores?.overall || 0), 0) /
    firstHalf.length;
  const secondHalfAvg =
    secondHalf.reduce((sum, s) => sum + (s.scores?.overall || 0), 0) /
    secondHalf.length;

  const change = secondHalfAvg - firstHalfAvg;
  const changePercentage = firstHalfAvg > 0 ? (change / firstHalfAvg) * 100 : 0;

  let direction = "stable";
  let message = "Meeting quality is stable";

  if (change > 5) {
    direction = "improving";
    message = `Meeting quality is improving! Up ${changePercentage.toFixed(1)}% over recent meetings.`;
  } else if (change < -5) {
    direction = "declining";
    message = `Meeting quality is declining. Down ${Math.abs(changePercentage).toFixed(1)}% over recent meetings.`;
  }

  return {
    direction,
    changePercentage: Math.round(changePercentage * 10) / 10,
    change: Math.round(change * 10) / 10,
    message,
    recentAverage: Math.round(secondHalfAvg * 10) / 10,
    previousAverage: Math.round(firstHalfAvg * 10) / 10,
  };
};

/**
 * Get best practice examples from organization
 */
export const getBestPractices = async (orgId, category = null) => {
  try {
    const query = {
      organization: orgId,
      status: "completed",
      "scores.overall": { $gte: 85 },
    };

    if (category) {
      query[`scores.${category}`] = { $gte: 90 };
    }

    const bestMeetings = await MeetingQualityScore.find(query)
      .populate("meeting", "title date meetingType uploadedBy agendaItems")
      .sort({ "scores.overall": -1 })
      .limit(10);

    return bestMeetings.map((score) => ({
      meetingId: score.meeting?._id,
      title: score.meeting?.title,
      date: score.meeting?.date,
      type: score.meetingType,
      scores: score.scores,
      badges: score.badges,
      insights: score.insights.filter((i) => i.type === "strength"),
      recommendations: score.recommendations,
    }));
  } catch (error) {
    console.error("Error getting best practices:", error);
    throw error;
  }
};

export default {
  generateUserRecommendations,
  getBestPractices,
};
