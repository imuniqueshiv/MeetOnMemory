import Meeting from "../models/meetingModel.js";
import MeetingCostConfig, {
  normalizeOverrideEmail,
  readMemberRateOverrides,
} from "../models/meetingCostConfigModel.js";
import mongoose from "mongoose";

/**
 * Defaults used when an organization has never saved a config.
 *
 * Previously inlined at both call sites, so the two could drift — and one of
 * them built a `new Map()` while the other built a plain `{}`, which meant the
 * `.get()` below would have thrown had the second path ever been taken.
 */
const DEFAULT_CONFIG = {
  defaultHourlyRate: 50,
  currency: "USD",
  memberRateOverrides: [],
  includePreparationTime: false,
  prepTimeMultiplier: 1.0,
};

/**
 * Resolves the hourly rate for one participant.
 *
 * The lookup is by *normalized* email (Issue #1161). The old
 * `config.memberRateOverrides.get(participant.email)` was exact-match and
 * case-sensitive on top of being permanently empty, so an override entered as
 * `Jane.Doe@Example.com` would not have applied to a participant recorded as
 * `jane.doe@example.com` even if the map had worked.
 */
const rateForParticipant = (participant, overrides, defaultHourlyRate) => {
  const email = normalizeOverrideEmail(participant?.email);
  if (email && overrides.has(email)) return overrides.get(email);
  return defaultHourlyRate;
};

class MeetingCostService {
  /**
   * Calculate cost for a single meeting
   */
  async calculateMeetingCost(meetingId) {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      throw new Error("Meeting not found");
    }

    if (!meeting.duration || meeting.duration <= 0) {
      return 0; // Free meeting if no duration
    }

    const config =
      (await MeetingCostConfig.findOne({
        organization: meeting.organization,
      })) || DEFAULT_CONFIG;

    const overrides = readMemberRateOverrides(config);

    const durationHours = meeting.duration / 60;
    const actualDuration = config.includePreparationTime
      ? durationHours * config.prepTimeMultiplier
      : durationHours;

    let totalCost = 0;

    // We assume participants array has email field
    if (meeting.participants && meeting.participants.length > 0) {
      for (const participant of meeting.participants) {
        totalCost +=
          rateForParticipant(participant, overrides, config.defaultHourlyRate) *
          actualDuration;
      }
    } else {
      // If no participants listed, assume 1 participant (uploadedBy)
      totalCost = config.defaultHourlyRate * actualDuration;
    }

    return totalCost;
  }

  /**
   * Get organization cost analytics (trend by month and type)
   */
  async getOrganizationCostAnalytics(orgId, startDate, endDate) {
    // `new mongoose.Types.ObjectId(orgId)` threw a raw `BSONError` for a
    // session with no organization, which the controller reported as
    // "500 Server Error" (Issue #1161).
    if (!mongoose.isValidObjectId(orgId)) {
      throw new Error("A valid organization is required for cost analytics");
    }

    const matchStage = {
      organization: new mongoose.Types.ObjectId(orgId),
      status: "completed",
    };

    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    const meetings = await Meeting.find(matchStage);

    const config =
      (await MeetingCostConfig.findOne({ organization: orgId })) ||
      DEFAULT_CONFIG;
    const overrides = readMemberRateOverrides(config);

    let totalCost = 0;
    let totalTimeMins = 0;
    let mostExpensiveMeeting = null;
    let maxCost = 0;
    const costByMonth = {};
    const costByType = {};

    for (const meeting of meetings) {
      if (!meeting.duration) continue;

      const durationHours = meeting.duration / 60;
      const actualDuration = config.includePreparationTime
        ? durationHours * config.prepTimeMultiplier
        : durationHours;

      let meetingCost = 0;
      const numParticipants = meeting.participants?.length || 1;

      if (meeting.participants && meeting.participants.length > 0) {
        for (const participant of meeting.participants) {
          meetingCost +=
            rateForParticipant(
              participant,
              overrides,
              config.defaultHourlyRate,
            ) * actualDuration;
        }
      } else {
        meetingCost = config.defaultHourlyRate * actualDuration;
      }

      totalCost += meetingCost;
      totalTimeMins += meeting.duration * numParticipants;

      if (meetingCost > maxCost) {
        maxCost = meetingCost;
        mostExpensiveMeeting = {
          _id: meeting._id,
          title: meeting.title,
          cost: meetingCost,
          date: meeting.date,
        };
      }

      // Group by month
      const month = new Date(meeting.date).toLocaleString("default", {
        month: "short",
        year: "numeric",
      });
      costByMonth[month] = (costByMonth[month] || 0) + meetingCost;

      // Group by type
      const type = meeting.meetingType || "other";
      costByType[type] = (costByType[type] || 0) + meetingCost;
    }

    const costByMonthArray = Object.keys(costByMonth)
      .map((month) => ({
        month,
        cost: costByMonth[month],
      }))
      .sort((a, b) => new Date(a.month) - new Date(b.month));

    const costByTypeArray = Object.keys(costByType).map((type) => ({
      type,
      cost: costByType[type],
    }));

    return {
      totalCost,
      totalTimeHours: totalTimeMins / 60,
      mostExpensiveMeeting,
      costByMonth: costByMonthArray,
      costByType: costByTypeArray,
      currency: config.currency,
    };
  }

  /**
   * Get member time analytics (leaderboard)
   */
  async getMemberTimeAnalytics(orgId, startDate, endDate) {
    if (!mongoose.isValidObjectId(orgId)) {
      throw new Error("A valid organization is required for member analytics");
    }

    const matchStage = {
      organization: new mongoose.Types.ObjectId(orgId),
      status: "completed",
    };

    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    // We can use aggregation to unwind participants and group by email/name
    const pipeline = [
      { $match: matchStage },
      { $match: { duration: { $gt: 0 } } },
      { $unwind: { path: "$participants", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$participants.email",
          name: { $first: "$participants.name" },
          totalMeetings: { $sum: 1 },
          totalDurationMins: { $sum: "$duration" },
        },
      },
      {
        $project: {
          email: "$_id",
          name: 1,
          totalMeetings: 1,
          totalHours: { $divide: ["$totalDurationMins", 60] },
          _id: 0,
        },
      },
      { $sort: { totalHours: -1 } },
    ];

    const results = await Meeting.aggregate(pipeline);

    // Fallback for missing emails
    return results.map((r) => ({
      name: r.name || r.email || "Unknown",
      email: r.email,
      totalMeetings: r.totalMeetings,
      totalHours: r.totalHours,
    }));
  }
}

export default new MeetingCostService();
