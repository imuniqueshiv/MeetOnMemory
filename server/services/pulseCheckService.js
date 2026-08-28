import MeetingPulseCheck from "../models/meetingPulseCheckModel.js";
import Meeting from "../models/meetingModel.js";

const WINDOW_MINUTES = 3;
const THRESHOLD_PERCENTAGE = 0.2;

class PulseCheckService {
  /**
   * Records a new pulse signal from a user.
   */
  async recordSignal(meetingId, userId, signalType) {
    if (!meetingId || !userId || !signalType) {
      throw new Error("Missing required fields for pulse signal");
    }

    const signal = new MeetingPulseCheck({
      meetingId,
      userId,
      signalType,
    });

    await signal.save();
    return signal;
  }

  /**
   * Checks if the given signal type has crossed the threshold in the recent time window.
   * Returns { isThresholdMet, count, threshold }
   */
  async checkThreshold(meetingId, signalType) {
    const meeting = await Meeting.findById(meetingId).select("participants");
    if (!meeting) {
      throw new Error("Meeting not found");
    }

    const totalParticipants = meeting.participants?.length || 1;
    // We need at least 1 person, though 0 shouldn't happen.
    // If there's 1 participant (only host), 20% of 1 is 0.2, so 1 vote triggers it.

    const timeWindow = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

    // Get distinct user IDs who sent this signal type within the time window
    const distinctUsers = await MeetingPulseCheck.distinct("userId", {
      meetingId,
      signalType,
      createdAt: { $gte: timeWindow },
    });

    const signalCount = distinctUsers.length;
    const requiredCount = Math.ceil(totalParticipants * THRESHOLD_PERCENTAGE);

    return {
      isThresholdMet: signalCount >= requiredCount,
      count: signalCount,
      required: requiredCount,
      totalParticipants,
    };
  }
}

export default new PulseCheckService();
