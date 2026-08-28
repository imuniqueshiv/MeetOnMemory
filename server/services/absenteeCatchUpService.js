import Meeting from "../models/meetingModel.js";
import MeetingRsvp from "../models/meetingRsvpModel.js";
import AbsenteeCatchUp from "../models/absenteeCatchUpModel.js";
import { generateAbsenteeCatchUpAI } from "./GenerativeAIService.js";

class AbsenteeCatchUpService {
  /**
   * Process a meeting to identify absentees and generate their catch-up digests.
   * @param {string} meetingId
   */
  static async processMeetingAbsentees(meetingId) {
    try {
      const meeting =
        await Meeting.findById(meetingId).populate("participants.user");
      if (!meeting) throw new Error("Meeting not found");
      if (meeting.status !== "completed") {
        console.log(
          `[AbsenteeCatchUpService] Meeting ${meetingId} is not completed. Skipping.`,
        );
        return;
      }

      // 1. Find RSVPs for this meeting
      const rsvps = await MeetingRsvp.find({ meetingId }).populate("userId");

      // 2. Determine actual participants
      const participantIds = meeting.participants
        .filter((p) => p.user)
        .map((p) => p.user._id.toString());

      // 3. Identify absentees: users who RSVP'd but didn't attend
      const absentees = rsvps
        .filter(
          (rsvp) =>
            rsvp.userId && !participantIds.includes(rsvp.userId._id.toString()),
        )
        .map((rsvp) => rsvp.userId);

      if (absentees.length === 0) {
        console.log(
          `[AbsenteeCatchUpService] No absentees found for meeting ${meetingId}.`,
        );
        return;
      }

      console.log(
        `[AbsenteeCatchUpService] Found ${absentees.length} absentees for meeting ${meetingId}. Generating digests...`,
      );

      const meetingSummary = {
        title: meeting.title,
        date: meeting.date,
        summary:
          meeting.summary ||
          (meeting.structuredMoM && meeting.structuredMoM.summary) ||
          "No general summary available.",
      };

      const decisions = meeting.structuredMoM?.decisions || [];
      const actionItems = meeting.structuredMoM?.action_items || [];

      // Generate a digest for each absentee
      for (const absentee of absentees) {
        // Check if a catch-up already exists to avoid duplicates
        const existing = await AbsenteeCatchUp.findOne({
          meetingId,
          userId: absentee._id,
        });
        if (existing) {
          console.log(
            `[AbsenteeCatchUpService] Catch-up already exists for user ${absentee._id} in meeting ${meetingId}. Skipping.`,
          );
          continue;
        }

        // We can optionally scan the transcript for their name to pass as mentions
        // For now, we'll extract action items assigned specifically to them based on their name.
        const absenteeName =
          `${absentee.firstName} ${absentee.lastName}`.trim();
        const mentions = []; // Advanced: grep the transcript for absenteeName

        try {
          const aiResult = await generateAbsenteeCatchUpAI(
            meeting.title,
            absenteeName,
            meetingSummary,
            actionItems,
            decisions,
            mentions,
          );

          await AbsenteeCatchUp.create({
            meetingId,
            userId: absentee._id,
            content: aiResult,
            status: "pending",
          });

          console.log(
            `[AbsenteeCatchUpService] Successfully generated catch-up for ${absenteeName}.`,
          );
        } catch (aiErr) {
          console.error(
            `[AbsenteeCatchUpService] Failed to generate AI digest for ${absenteeName}:`,
            aiErr,
          );
        }
      }
    } catch (error) {
      console.error(
        "[AbsenteeCatchUpService] Error processing absentees:",
        error,
      );
    }
  }

  /**
   * Fetches pending catch-ups for a user.
   * @param {string} userId
   */
  static async getPendingCatchUps(userId) {
    return AbsenteeCatchUp.find({
      userId,
      status: { $in: ["pending", "delivered"] },
    })
      .populate("meetingId", "title date summary")
      .sort({ createdAt: -1 });
  }

  /**
   * Marks a catch-up as read.
   * @param {string} catchUpId
   */
  static async markAsRead(catchUpId) {
    return AbsenteeCatchUp.findByIdAndUpdate(
      catchUpId,
      { status: "read", readAt: new Date() },
      { new: true },
    );
  }

  /**
   * Manually deliver a catch-up (e.g., via email or push).
   * For MVP, we will just update the status.
   * @param {string} catchUpId
   */
  static async deliverCatchUp(catchUpId) {
    // In a real implementation, you'd integrate with EmailService here.
    return AbsenteeCatchUp.findByIdAndUpdate(
      catchUpId,
      { status: "delivered", sentAt: new Date() },
      { new: true },
    );
  }
}

export default AbsenteeCatchUpService;
