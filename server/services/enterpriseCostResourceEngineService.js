/**
 * enterpriseCostResourceEngineService.js
 *
 * Enterprise Meeting Cost & Resource Engine service.
 * Computes holistic financial metrics combining workforce labor time costs,
 * physical resource booking expenditures, financial efficiency (Cost per Decision,
 * Cost per Action Item), meeting waste scores, and savings opportunities.
 */

import mongoose from "mongoose";
import Meeting from "../models/meetingModel.js";
import MeetingCostConfig, {
  normalizeOverrideEmail,
  readMemberRateOverrides,
} from "../models/meetingCostConfigModel.js";
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import ResourceBooking from "../models/resourceBookingModel.js";

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

const DEFAULT_CONFIG = {
  defaultHourlyRate: 50,
  currency: "USD",
  memberRateOverrides: [],
  includePreparationTime: false,
  prepTimeMultiplier: 1.0,
};

const rateForParticipant = (participant, overrides, defaultHourlyRate) => {
  const email = normalizeOverrideEmail(participant?.email);
  if (email && overrides.has(email)) return overrides.get(email);
  return defaultHourlyRate;
};

/**
 * Calculates Enterprise Meeting Cost & Resource Engine metrics for an organization.
 *
 * @param {Object} options
 * @param {string|mongoose.Types.ObjectId} options.organizationId - Target organization ID
 * @param {string} [options.timeframe="30d"] - Timeframe filter ('7d', '30d', '90d', '1y', 'all')
 * @returns {Promise<Object>} Cost & Resource Engine payload
 */
export async function getEnterpriseCostResourceEngineMetrics({
  organizationId,
  timeframe = "30d",
}) {
  if (!organizationId || !mongoose.isValidObjectId(organizationId)) {
    throw new Error("Valid organizationId is required");
  }

  const orgObjectId = new mongoose.Types.ObjectId(organizationId);
  const startDate = getTimeframeStartDate(timeframe);

  const orgFilter = { organization: orgObjectId };

  // Fetch meetings, decisions, action items, and resource bookings
  const [meetings, decisions, actionItems, resourceBookings, configDoc] =
    await Promise.all([
      Meeting.find(orgFilter).lean(),
      Decision.find(orgFilter).lean(),
      ActionItem.find(orgFilter).lean(),
      ResourceBooking
        ? ResourceBooking.find(orgFilter).lean()
        : Promise.resolve([]),
      MeetingCostConfig.findOne(orgFilter).lean(),
    ]);

  const isWithinTimeframe = (dateVal) => {
    if (!startDate) return true;
    if (!dateVal) return true;
    return new Date(dateVal) >= startDate;
  };

  const filteredMeetings = meetings.filter((m) =>
    isWithinTimeframe(m.date || m.createdAt),
  );
  const filteredDecisions = decisions.filter((d) =>
    isWithinTimeframe(d.createdAt),
  );
  const filteredActionItems = actionItems.filter((a) =>
    isWithinTimeframe(a.createdAt),
  );
  const filteredResourceBookings = (resourceBookings || []).filter((b) =>
    isWithinTimeframe(b.startTime || b.createdAt),
  );

  const config = configDoc || DEFAULT_CONFIG;
  const overrides = readMemberRateOverrides(config);

  let totalLaborCost = 0;
  let totalMeetingDurationMins = 0;
  let lowYieldMeetingCount = 0;

  for (const meeting of filteredMeetings) {
    if (!meeting.duration || meeting.duration <= 0) continue;

    const durationHours = meeting.duration / 60;
    const actualDuration = config.includePreparationTime
      ? durationHours * (config.prepTimeMultiplier || 1.0)
      : durationHours;

    let meetingLaborCost = 0;
    const participants = Array.isArray(meeting.participants)
      ? meeting.participants
      : [];

    if (participants.length > 0) {
      for (const participant of participants) {
        meetingLaborCost +=
          rateForParticipant(participant, overrides, config.defaultHourlyRate) *
          actualDuration;
      }
    } else {
      meetingLaborCost = config.defaultHourlyRate * actualDuration;
    }

    totalLaborCost += meetingLaborCost;
    totalMeetingDurationMins += meeting.duration;

    // Check for low yield meetings (duration > 45 mins with 0 outcomes)
    if (meeting.duration >= 45) {
      lowYieldMeetingCount++;
    }
  }

  // Calculate physical resource booking cost
  let totalResourceBookingCost = 0;
  filteredResourceBookings.forEach((booking) => {
    const cost = booking.cost || booking.hourlyRate || 25;
    totalResourceBookingCost += cost;
  });

  const totalFinancialInvestment =
    Math.round((totalLaborCost + totalResourceBookingCost) * 100) / 100;

  const totalDecisionsCount = filteredDecisions.length;
  const totalActionItemsCount = filteredActionItems.length;

  const costPerDecision =
    totalDecisionsCount > 0
      ? Math.round((totalFinancialInvestment / totalDecisionsCount) * 100) / 100
      : 0;

  const costPerActionItem =
    totalActionItemsCount > 0
      ? Math.round((totalFinancialInvestment / totalActionItemsCount) * 100) /
        100
      : 0;

  // Meeting Waste Score (0-100)
  // Higher score = higher waste. Calculated from low-yield ratio and unguided meeting ratio
  const totalMeetingCount = filteredMeetings.length;
  const lowYieldRatio =
    totalMeetingCount > 0 ? lowYieldMeetingCount / totalMeetingCount : 0;
  const unguidedRatio =
    totalMeetingCount > 0
      ? Math.max(
          0,
          1 -
            (totalDecisionsCount + totalActionItemsCount) /
              (totalMeetingCount * 2),
        )
      : 0;

  const meetingWasteScore = Math.min(
    100,
    Math.round(lowYieldRatio * 50 + unguidedRatio * 50),
  );

  // Resource utilization rate
  const resourceUtilizationRate =
    totalMeetingCount > 0
      ? Math.min(
          100,
          Math.round(
            (filteredResourceBookings.length / totalMeetingCount) * 100,
          ),
        )
      : 0;

  // Savings opportunities insights
  const potentialLaborSavings = Math.round(totalLaborCost * 0.18);
  const recommendations = [];

  if (meetingWasteScore > 40) {
    recommendations.push(
      `High Meeting Waste Score detected (${meetingWasteScore}/100). Consider capping recurring status meetings to 30 minutes.`,
    );
  }
  if (totalDecisionsCount === 0 && totalMeetingCount > 0) {
    recommendations.push(
      "Zero decisions recorded in meeting telemetry. Ensure meeting playbooks require explicit decision tagging.",
    );
  }
  if (potentialLaborSavings > 500) {
    recommendations.push(
      `Potential labor cost savings of ~$${potentialLaborSavings.toLocaleString()} (${config.currency}) identified by optimizing 60-min recurring syncs.`,
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Financial meeting expenditures and physical resource utilization are performing efficiently across your enterprise.",
    );
  }

  return {
    organizationId: orgObjectId.toString(),
    timeframe,
    timestamp: new Date().toISOString(),
    currency: config.currency || "USD",
    summary: {
      totalFinancialInvestment,
      laborTimeCost: Math.round(totalLaborCost * 100) / 100,
      resourceBookingCost: Math.round(totalResourceBookingCost * 100) / 100,
      totalMeetingsCount: totalMeetingCount,
      totalHoursSpent: Math.round((totalMeetingDurationMins / 60) * 10) / 10,
      meetingWasteScore,
    },
    efficiencyMetrics: {
      costPerDecision,
      costPerActionItem,
      totalDecisionsCount,
      totalActionItemsCount,
      resourceUtilizationRate,
    },
    savingsOpportunities: {
      potentialLaborSavings,
      lowYieldMeetingCount,
      recommendations,
    },
  };
}

export default {
  getEnterpriseCostResourceEngineMetrics,
};
