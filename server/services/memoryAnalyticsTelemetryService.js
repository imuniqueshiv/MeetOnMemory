/**
 * memoryAnalyticsTelemetryService.js
 *
 * Enterprise Memory Analytics Telemetry service.
 * Aggregates organization-level telemetry on Decisions and Action Items,
 * covering lifecycle distribution, dynamic importance scoring trends,
 * access velocity, consolidation metrics, and retention compliance.
 */

import mongoose from "mongoose";
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";

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
 * Calculates enterprise memory telemetry metrics for an organization.
 *
 * @param {Object} options
 * @param {string|mongoose.Types.ObjectId} options.organizationId - The target organization ID
 * @param {string} [options.timeframe="30d"] - Timeframe filter ('7d', '30d', '90d', '1y', 'all')
 * @returns {Promise<Object>} Telemetry data payload
 */
export async function getEnterpriseMemoryTelemetry({
  organizationId,
  timeframe = "30d",
}) {
  if (!organizationId || !mongoose.Types.ObjectId.isValid(organizationId)) {
    throw new Error("Valid organizationId is required");
  }

  const orgObjectId = new mongoose.Types.ObjectId(organizationId);
  const startDate = getTimeframeStartDate(timeframe);

  const orgFilter = { organization: orgObjectId };

  // Fetch all decisions and action items for the org
  const [decisions, actionItems] = await Promise.all([
    Decision.find(orgFilter).lean(),
    ActionItem.find(orgFilter).lean(),
  ]);

  const allMemories = [
    ...decisions.map((d) => ({ ...d, memoryType: "decision" })),
    ...actionItems.map((a) => ({ ...a, memoryType: "actionItem" })),
  ];

  const totalCount = allMemories.length;

  // Lifecycle breakdown
  const lifecycleDistribution = {
    active: 0,
    dormant: 0,
    archived: 0,
    expired: 0,
  };

  // Importance metrics
  let totalImportanceScore = 0;
  const importanceBuckets = {
    high: 0, // >= 70
    medium: 0, // 40-69
    low: 0, // < 40
  };
  let protectedCount = 0;

  // Access & velocity metrics
  let totalAccesses = 0;
  let accessedInTimeframe = 0;
  let createdInTimeframe = 0;

  // Consolidation & transitions
  let mergedMemoriesCount = 0;
  let totalTransitionsLogged = 0;

  const now = Date.now();
  let totalDaysSinceLastAccess = 0;
  let memoryWithAccessDateCount = 0;

  for (const item of allMemories) {
    const state = item.lifecycleState || "active";
    if (lifecycleDistribution[state] !== undefined) {
      lifecycleDistribution[state]++;
    } else {
      lifecycleDistribution.active++;
    }

    const score = item.importanceScore || 0;
    totalImportanceScore += score;
    if (score >= 70) {
      importanceBuckets.high++;
      protectedCount++;
    } else if (score >= 40) {
      importanceBuckets.medium++;
    } else {
      importanceBuckets.low++;
    }

    const accesses = item.accessCount || 0;
    totalAccesses += accesses;

    const createdAt = item.createdAt ? new Date(item.createdAt) : null;
    if (createdAt && startDate && createdAt >= startDate) {
      createdInTimeframe++;
    } else if (!startDate) {
      createdInTimeframe++;
    }

    const lastAccessedAt = item.lastAccessedAt
      ? new Date(item.lastAccessedAt)
      : null;
    if (lastAccessedAt) {
      memoryWithAccessDateCount++;
      const daysDiff = (now - lastAccessedAt.getTime()) / (1000 * 60 * 60 * 24);
      totalDaysSinceLastAccess += Math.max(0, daysDiff);

      if (startDate && lastAccessedAt >= startDate) {
        accessedInTimeframe++;
      } else if (!startDate) {
        accessedInTimeframe++;
      }
    }

    if (Array.isArray(item.mergedFrom) && item.mergedFrom.length > 0) {
      mergedMemoriesCount += item.mergedFrom.length;
    }

    if (Array.isArray(item.lifecycleHistory)) {
      totalTransitionsLogged += item.lifecycleHistory.length;
    }
  }

  const avgImportanceScore =
    totalCount > 0
      ? Math.round((totalImportanceScore / totalCount) * 10) / 10
      : 0;

  const avgDaysSinceLastAccess =
    memoryWithAccessDateCount > 0
      ? Math.round(
          (totalDaysSinceLastAccess / memoryWithAccessDateCount) * 10,
        ) / 10
      : 0;

  // Active memory ratio
  const activeRatio =
    totalCount > 0
      ? Math.round((lifecycleDistribution.active / totalCount) * 100)
      : 100;

  // Organization Memory Health Index (0-100)
  // Weighted: 40% active ratio, 30% avg importance, 30% access activity ratio
  const activityRatio =
    totalCount > 0
      ? Math.min(100, Math.round((accessedInTimeframe / totalCount) * 100))
      : 100;

  const memoryHealthScore = Math.min(
    100,
    Math.round(
      activeRatio * 0.4 + avgImportanceScore * 0.3 + activityRatio * 0.3,
    ),
  );

  // Recommendations
  const recommendations = [];
  if (lifecycleDistribution.dormant > totalCount * 0.3 && totalCount > 5) {
    recommendations.push(
      "High proportion of dormant memories. Consider running a lifecycle sweep.",
    );
  }
  if (importanceBuckets.low > totalCount * 0.5 && totalCount > 5) {
    recommendations.push(
      "Over 50% of memories have low importance scores. Review and recalculate importance scores.",
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Memory retention and health metrics are optimal across your organization.",
    );
  }

  return {
    organizationId: orgObjectId.toString(),
    timeframe,
    timestamp: new Date().toISOString(),
    summary: {
      totalMemories: totalCount,
      decisionsCount: decisions.length,
      actionItemsCount: actionItems.length,
      memoryHealthScore,
      activeRatioPercentage: activeRatio,
    },
    lifecycleDistribution,
    importanceMetrics: {
      averageScore: avgImportanceScore,
      protectedCount,
      protectedPercentage:
        totalCount > 0 ? Math.round((protectedCount / totalCount) * 100) : 0,
      distribution: importanceBuckets,
    },
    velocityMetrics: {
      totalAccesses,
      createdInTimeframe,
      accessedInTimeframe,
      avgDaysSinceLastAccess,
    },
    consolidationMetrics: {
      mergedMemoriesCount,
      totalTransitionsLogged,
    },
    recommendations,
  };
}
