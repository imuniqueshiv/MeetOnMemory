import participantContributionService from "../services/participantContributionService.js";
import ParticipantContribution from "../models/participantContributionModel.js";
import { computeEquityBreakdown } from "../utils/contributionEquity.js";

/**
 * Get contributions for a specific meeting
 */
export const getContributionsByMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const contributions = await ParticipantContribution.find({
      meetingId,
    }).lean();

    // If none exist, calculate them on the fly (for backwards compatibility/demo)
    if (!contributions || contributions.length === 0) {
      const calculated =
        await participantContributionService.calculateForMeeting(meetingId);
      const equityScore =
        await participantContributionService.calculateMeetingEquity(meetingId);

      return res.status(200).json({
        contributions: calculated,
        equityScore,
        equity: computeEquityBreakdown(calculated),
      });
    }

    const equityScore =
      await participantContributionService.calculateMeetingEquity(meetingId);

    res.status(200).json({
      contributions,
      equityScore,
      equity: computeEquityBreakdown(contributions),
    });
  } catch (error) {
    console.error("Error fetching participant contributions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Manually trigger calculation of contributions for a meeting
 */
export const calculateContributions = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const contributions =
      await participantContributionService.calculateForMeeting(meetingId);
    const equityScore =
      await participantContributionService.calculateMeetingEquity(meetingId);

    res.status(200).json({
      message: "Contributions calculated successfully",
      contributions,
      equityScore,
      equity: computeEquityBreakdown(contributions),
    });
  } catch (error) {
    console.error("Error calculating participant contributions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
