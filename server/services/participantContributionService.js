import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
import Comment from "../models/commentModel.js";
import Reaction from "../models/reactionModel.js";
import AgendaProposal from "../models/agendaProposalModel.js";
import ParticipantContribution from "../models/participantContributionModel.js";
import { getBreakdownForMeeting } from "./speakingTimeService.js";

/**
 * Normalizes a raw value to a 0-100 scale using a max threshold
 */
const normalize = (value, maxThreshold) => {
  if (value >= maxThreshold) return 100;
  return Math.round((value / maxThreshold) * 100);
};

/**
 * Generates simple AI coaching tips based on dimension scores
 */
const generateCoachingTips = (dimensions) => {
  const tips = [];
  if (dimensions.verbal > 80 && dimensions.decisional < 30) {
    tips.push(
      "You are speaking a lot but driving few decisions. Try to focus your input on actionable outcomes.",
    );
  }
  if (dimensions.verbal < 30 && dimensions.task > 70) {
    tips.push(
      "You are a quiet contributor doing great work on tasks! Consider sharing your insights verbally more often.",
    );
  }
  if (dimensions.collaborative > 80) {
    tips.push(
      "Excellent collaboration! You are highly engaged with others' ideas.",
    );
  }
  if (dimensions.decisional > 80) {
    tips.push("Strong leadership in driving decisions this meeting.");
  }

  if (tips.length === 0) {
    tips.push("Balanced participation across all dimensions.");
  }
  return tips;
};

/**
 * Calculates and stores contributions for all participants in a meeting
 */
export const calculateForMeeting = async (meetingId) => {
  const meeting = await Meeting.findById(meetingId).lean();
  if (!meeting) throw new Error("Meeting not found");

  const participants = meeting.participants || [];
  if (participants.length === 0) return [];

  // Get speaking stats
  const speakingStats = await getBreakdownForMeeting(meetingId);
  const speakingMap = new Map();
  if (speakingStats && speakingStats.participants) {
    speakingStats.participants.forEach((p) => {
      speakingMap.set(p.identifier, p);
    });
  }

  // Get other metrics concurrently
  const [actionItems, decisions, comments, reactions, agendaProposals] =
    await Promise.all([
      ActionItem.find({ meeting: meetingId }).lean(),
      Decision.find({ meeting: meetingId }).lean(),
      Comment.find({ meeting: meetingId }).lean(),
      Reaction.find({ meeting: meetingId }).lean(),
      AgendaProposal.find({ meeting: meetingId }).lean(),
    ]);

  const contributions = [];

  for (const p of participants) {
    const pIdStr = p.user ? p.user.toString() : p.name;
    const name = p.name || "Unknown";

    // 1. Verbal Metrics
    const speakData = speakingMap.get(pIdStr) ||
      speakingMap.get(name) || { totalDuration: 0, utteranceCount: 0 };
    const speakingDurationSec = Math.round(speakData.totalDuration / 1000);
    const utteranceCount = speakData.utteranceCount;

    // 2. Task Metrics
    const actionItemsOwned = actionItems.filter(
      (ai) => ai.assignee && ai.assignee.toString() === pIdStr,
    ).length;
    const actionItemsCompleted = actionItems.filter(
      (ai) =>
        ai.assignee &&
        ai.assignee.toString() === pIdStr &&
        ai.status === "completed",
    ).length;

    // 3. Decisional Metrics
    const decisionsAuthored = decisions.filter(
      (d) => d.author && d.author.toString() === pIdStr,
    ).length;

    // 4. Collaborative Metrics
    const commentsAdded = comments.filter(
      (c) => c.author && c.author.toString() === pIdStr,
    ).length;
    const reactionsGiven = reactions.filter(
      (r) => r.user && r.user.toString() === pIdStr,
    ).length;
    const agendaProposalsCount = agendaProposals.filter(
      (ap) => ap.proposer && ap.proposer.toString() === pIdStr,
    ).length;

    // Normalize Dimensions (Thresholds can be adjusted later or made dynamic)
    const verbal = normalize(speakingDurationSec, 600); // 10 minutes max
    const task = normalize(actionItemsOwned + actionItemsCompleted, 5); // 5 tasks max
    const decisional = normalize(decisionsAuthored, 3); // 3 decisions max
    const collaborative = normalize(
      commentsAdded + reactionsGiven + agendaProposalsCount,
      15,
    ); // 15 interactions max

    const dimensions = { verbal, task, decisional, collaborative };

    // Overall Impact (Equal weighting for simplicity)
    const overallImpact = Math.round(
      (verbal + task + decisional + collaborative) / 4,
    );

    const coachingTips = generateCoachingTips(dimensions);

    const contribution = {
      meetingId,
      userId: p.user || null,
      participantId: pIdStr,
      participantName: name,
      dimensions,
      overallImpact,
      coachingTips,
      rawMetrics: {
        speakingDurationSec,
        utteranceCount,
        decisionsAuthored,
        actionItemsOwned,
        actionItemsCompleted,
        commentsAdded,
        reactionsGiven,
        agendaProposals: agendaProposalsCount,
      },
    };

    contributions.push(contribution);
  }

  // Upsert all contributions
  const bulkOps = contributions.map((c) => ({
    updateOne: {
      filter: { meetingId: c.meetingId, participantId: c.participantId },
      update: { $set: c },
      upsert: true,
    },
  }));

  if (bulkOps.length > 0) {
    await ParticipantContribution.bulkWrite(bulkOps);
  }

  return contributions;
};

/**
 * Calculates Meeting Equity (Gini Coefficient) based on Overall Impact
 * 0 = Perfect Equality (100 Equity Score)
 * 1 = Perfect Inequality (0 Equity Score)
 */
export const calculateMeetingEquity = async (meetingId) => {
  const contributions = await ParticipantContribution.find({ meetingId })
    .select("overallImpact")
    .lean();

  if (!contributions || contributions.length < 2) {
    return 100; // Cannot calculate for < 2 people, default to 100
  }

  const impacts = contributions
    .map((c) => c.overallImpact)
    .sort((a, b) => a - b);
  const n = impacts.length;
  const sum = impacts.reduce((a, b) => a + b, 0);

  if (sum === 0) return 100; // No one contributed, perfectly equal in a bad way

  let sumOfAbsoluteDifferences = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumOfAbsoluteDifferences += Math.abs(impacts[i] - impacts[j]);
    }
  }

  const gini = sumOfAbsoluteDifferences / (2 * Math.pow(n, 2) * (sum / n));
  const equityScore = Math.round((1 - gini) * 100);

  return equityScore;
};

export default {
  calculateForMeeting,
  calculateMeetingEquity,
};
