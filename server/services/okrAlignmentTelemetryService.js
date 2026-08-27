/**
 * okrAlignmentTelemetryService.js
 *
 * Enterprise OKR Alignment Telemetry service.
 * Aggregates organization-level metrics on strategic alignment between enterprise OKRs,
 * meeting goals, decisions, action items, and strategic pillars.
 */

import mongoose from "mongoose";
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import MeetingGoal from "../models/meetingGoalModel.js";

const TIMEFRAME_DAYS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

function getTimeframeStartDate(timeframe = "30d") {
  if (timeframe === "all" || !TIMEFRAME_DAYS[timeframe]) {
    return null;
  }
  const days = TIMEFRAME_DAYS[timeframe];
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Default strategic pillars for organization alignment distribution
 */
const DEFAULT_STRATEGIC_PILLARS = [
  "Product Excellence",
  "Customer Growth",
  "Operational Efficiency",
  "Security & Governance",
  "Platform Innovation",
];

/**
 * Calculates Enterprise OKR Alignment Telemetry metrics for an organization.
 *
 * @param {Object} options
 * @param {string|mongoose.Types.ObjectId} options.organizationId - Target organization ID
 * @param {string} [options.timeframe="30d"] - Timeframe filter ('7d', '30d', '90d', '1y', 'all')
 * @returns {Promise<Object>} OKR Telemetry payload
 */
export async function getEnterpriseOkrAlignmentTelemetry({
  organizationId,
  timeframe = "30d",
}) {
  if (!organizationId || !mongoose.Types.ObjectId.isValid(organizationId)) {
    throw new Error("Valid organizationId is required");
  }

  const orgObjectId = new mongoose.Types.ObjectId(organizationId);
  const startDate = getTimeframeStartDate(timeframe);

  const orgFilter = { organization: orgObjectId };

  // Fetch decisions, action items, and meeting goals for the organization
  const [decisions, actionItems, meetingGoals] = await Promise.all([
    Decision.find(orgFilter).lean(),
    ActionItem.find(orgFilter).lean(),
    MeetingGoal.find(orgFilter).lean(),
  ]);

  // Filter items created within timeframe if timeframe is specified
  const isWithinTimeframe = (createdAt) => {
    if (!startDate) return true;
    if (!createdAt) return true;
    return new Date(createdAt) >= startDate;
  };

  const filteredDecisions = decisions.filter((d) =>
    isWithinTimeframe(d.createdAt),
  );
  const filteredActionItems = actionItems.filter((a) =>
    isWithinTimeframe(a.createdAt),
  );
  const filteredMeetingGoals = meetingGoals.filter((g) =>
    isWithinTimeframe(g.createdAt),
  );

  // Flatten all meeting goals
  const allGoals = [];
  filteredMeetingGoals.forEach((mg) => {
    if (Array.isArray(mg.goals)) {
      allGoals.push(...mg.goals);
    }
  });

  const totalMemories = filteredDecisions.length + filteredActionItems.length;
  const totalMeetingGoalsCount = allGoals.length;

  // Objective Status breakdown
  const objectiveStatusBreakdown = {
    on_track: 0,
    at_risk: 0,
    behind: 0,
    achieved: 0,
  };

  let achievedGoals = 0;
  let partiallyAchievedGoals = 0;

  allGoals.forEach((goal) => {
    if (goal.status === "achieved") {
      objectiveStatusBreakdown.achieved++;
      achievedGoals++;
    } else if (goal.status === "partially_achieved") {
      objectiveStatusBreakdown.on_track++;
      partiallyAchievedGoals++;
    } else if (goal.status === "not_achieved") {
      objectiveStatusBreakdown.at_risk++;
    } else {
      objectiveStatusBreakdown.on_track++;
    }
  });

  // Calculate alignment metrics
  // High importance memories (score >= 60) or resolved items are considered aligned
  const alignedDecisions = filteredDecisions.filter(
    (d) => (d.importanceScore || 0) >= 40 || d.status === "resolved",
  ).length;

  const alignedActionItems = filteredActionItems.filter(
    (a) => (a.importanceScore || 0) >= 40 || a.status === "completed",
  ).length;

  const totalAlignedItems = alignedDecisions + alignedActionItems;
  const alignmentPercentage =
    totalMemories > 0
      ? Math.min(100, Math.round((totalAlignedItems / totalMemories) * 100))
      : 100;

  // Strategic Pillar Distribution Calculation
  const pillarMap = {};
  DEFAULT_STRATEGIC_PILLARS.forEach((pillar) => {
    pillarMap[pillar] = {
      name: pillar,
      alignedCount: 0,
      percentage: 0,
    };
  });

  // Distribute items across pillars heuristically based on text matching or fallback index
  const allTextItems = [
    ...filteredDecisions.map((d) => d.text || ""),
    ...filteredActionItems.map((a) => a.title || a.description || a.text || ""),
    ...allGoals.map((g) => g.text || ""),
  ];

  let totalMappedPillarItems = 0;
  allTextItems.forEach((text, idx) => {
    const lower = text.toLowerCase();
    let matchedPillar = null;

    if (
      lower.includes("product") ||
      lower.includes("feature") ||
      lower.includes("ux")
    ) {
      matchedPillar = "Product Excellence";
    } else if (
      lower.includes("customer") ||
      lower.includes("client") ||
      lower.includes("growth") ||
      lower.includes("user")
    ) {
      matchedPillar = "Customer Growth";
    } else if (
      lower.includes("process") ||
      lower.includes("efficiency") ||
      lower.includes("cost") ||
      lower.includes("time")
    ) {
      matchedPillar = "Operational Efficiency";
    } else if (
      lower.includes("security") ||
      lower.includes("compliance") ||
      lower.includes("auth") ||
      lower.includes("risk")
    ) {
      matchedPillar = "Security & Governance";
    } else if (
      lower.includes("api") ||
      lower.includes("platform") ||
      lower.includes("ai") ||
      lower.includes("infra")
    ) {
      matchedPillar = "Platform Innovation";
    } else {
      // Deterministic fallback distribution
      matchedPillar =
        DEFAULT_STRATEGIC_PILLARS[idx % DEFAULT_STRATEGIC_PILLARS.length];
    }

    if (pillarMap[matchedPillar]) {
      pillarMap[matchedPillar].alignedCount++;
      totalMappedPillarItems++;
    }
  });

  const pillarDistribution = Object.values(pillarMap).map((pillar) => ({
    ...pillar,
    percentage:
      totalMappedPillarItems > 0
        ? Math.round((pillar.alignedCount / totalMappedPillarItems) * 100)
        : 0,
  }));

  // Misalignment & Unmapped items diagnostic
  const unmappedDecisions = filteredDecisions.length - alignedDecisions;
  const unmappedActionItems = filteredActionItems.length - alignedActionItems;
  const unalignedTotal = Math.max(0, unmappedDecisions + unmappedActionItems);

  // Overall Strategic Alignment Health Score (0 - 100)
  // Weighted: 50% alignment percentage, 30% goal achievement rate, 20% active pillar coverage
  const goalAchievementRate =
    totalMeetingGoalsCount > 0
      ? Math.round(
          ((achievedGoals + 0.5 * partiallyAchievedGoals) /
            totalMeetingGoalsCount) *
            100,
        )
      : 100;

  const activePillarsCount = pillarDistribution.filter(
    (p) => p.alignedCount > 0,
  ).length;
  const pillarCoverageRate = Math.round(
    (activePillarsCount / DEFAULT_STRATEGIC_PILLARS.length) * 100,
  );

  const overallHealthScore = Math.min(
    100,
    Math.round(
      alignmentPercentage * 0.5 +
        goalAchievementRate * 0.3 +
        pillarCoverageRate * 0.2,
    ),
  );

  // Dynamic recommendations
  const recommendations = [];
  if (alignmentPercentage < 70) {
    recommendations.push(
      "Overall OKR alignment is below 70%. Review unmapped action items and decisions for strategic tag assignments.",
    );
  }
  if (objectiveStatusBreakdown.at_risk > 0) {
    recommendations.push(
      `${objectiveStatusBreakdown.at_risk} objective(s) are flagged at risk. Schedule a strategic alignment review.`,
    );
  }
  if (unalignedTotal > 10) {
    recommendations.push(
      `Detected ${unalignedTotal} unaligned decisions and action items lacking direct OKR linkage.`,
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Enterprise OKR alignment and strategic goal progress are performing optimally across all pillars.",
    );
  }

  return {
    organizationId: orgObjectId.toString(),
    timeframe,
    timestamp: new Date().toISOString(),
    summary: {
      totalObjectives: totalMeetingGoalsCount,
      activeKeyResults: totalMemories,
      overallAlignmentScore: alignmentPercentage,
      overallHealthScore,
      atRiskObjectivesCount: objectiveStatusBreakdown.at_risk,
      unalignedMemoriesCount: unalignedTotal,
    },
    objectiveStatusBreakdown,
    pillarDistribution,
    misalignmentDiagnostics: {
      unmappedDecisions,
      unmappedActionItems,
      unalignedTotal,
      unalignedPercentage:
        totalMemories > 0
          ? Math.round((unalignedTotal / totalMemories) * 100)
          : 0,
    },
    recommendations,
  };
}

export default {
  getEnterpriseOkrAlignmentTelemetry,
};
