import RecapPreference from "../models/recapPreferenceModel.js";
import RecapDelivery from "../models/recapDeliveryModel.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import User from "../models/userModel.js";
import EmailService from "./EmailService.js";
import { formatInTimeZone } from "date-fns-tz";

class RecapEmailService {
  /**
   * Check if current time is within user's quiet hours
   */
  static isQuietHours(preferences, date = new Date()) {
    const { quietHoursStart, quietHoursEnd, timezone } = preferences;

    if (quietHoursStart == null || quietHoursEnd == null) return false;

    // Get current hour in user's timezone
    const tzDate = formatInTimeZone(
      date,
      timezone || "UTC",
      "yyyy-MM-dd'T'HH:mm:ssXXX",
    );
    const currentHour = new Date(tzDate).getHours();

    if (quietHoursStart < quietHoursEnd) {
      return currentHour >= quietHoursStart && currentHour < quietHoursEnd;
    } else {
      // Crosses midnight
      return currentHour >= quietHoursStart || currentHour < quietHoursEnd;
    }
  }

  /**
   * Build HTML for a single meeting recap
   */
  static async buildRecapHtml(meeting, preferences) {
    const { includeSummary, includeActionItems, includeTranscript } =
      preferences;
    let html = `<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333; border: 1px solid #eee; border-radius: 10px;">`;

    const dateStr = meeting.date
      ? new Date(meeting.date).toLocaleDateString()
      : "Unknown Date";
    html += `<h2 style="color: #2563eb;">Meeting Recap: ${meeting.title}</h2>`;
    html += `<p style="color: #666;">Date: ${dateStr}</p>`;
    html += `<hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />`;

    if (includeSummary && meeting.summary) {
      html += `<h3 style="color: #1e40af;">Summary</h3>`;
      html += `<p style="white-space: pre-wrap;">${meeting.summary}</p>`;
    }

    if (includeActionItems) {
      const actionItems = await ActionItem.find({
        sourceMeetingId: meeting._id,
      });
      if (actionItems.length > 0) {
        html += `<h3 style="color: #1e40af;">Action Items</h3><ul>`;
        actionItems.forEach((ai) => {
          html += `<li style="margin-bottom: 8px;">
            <strong>${ai.owner}:</strong> ${ai.text} 
            ${ai.dueDate ? `<em>(Due: ${new Date(ai.dueDate).toLocaleDateString()})</em>` : ""}
          </li>`;
        });
        html += `</ul>`;
      }
    }

    if (includeTranscript && meeting.transcript) {
      html += `<h3 style="color: #1e40af;">Transcript Snippet</h3>`;
      // truncate transcript
      const snippet =
        meeting.transcript.length > 500
          ? meeting.transcript.substring(0, 500) + "..."
          : meeting.transcript;
      html += `<div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; font-size: 14px; font-style: italic; white-space: pre-wrap;">${snippet}</div>`;
    }

    html += `</div>`;
    return html;
  }

  /**
   * Send immediate recap for a processed meeting
   */
  static async sendImmediateRecap(meetingId) {
    try {
      const meeting = await Meeting.findById(meetingId);
      if (!meeting) return;

      // Find all participants (users) in our system
      // Assuming participants are matched by email or uploadedBy is the only one we know for sure
      // Let's get the uploadedBy user and any other users linked via participants
      const participantEmails = meeting.participants
        .map((p) => p.email)
        .filter(Boolean);

      const usersToNotify = await User.find({
        $or: [
          { _id: meeting.uploadedBy },
          { email: { $in: participantEmails } },
        ],
      });

      for (const user of usersToNotify) {
        // Check if already delivered
        const alreadyDelivered = await RecapDelivery.findOne({
          meetingId,
          userId: user._id,
        });
        if (alreadyDelivered) continue;

        // Get preferences
        let preferences = await RecapPreference.findOne({ userId: user._id });
        if (!preferences) {
          // Default preferences
          preferences = {
            deliveryTiming: "immediate",
            includeSummary: true,
            includeActionItems: true,
            includeTranscript: true,
            timezone: "UTC",
          };
        }

        if (preferences.deliveryTiming !== "immediate") continue;

        if (this.isQuietHours(preferences)) {
          console.log(
            `[RecapEmailService] Deferring immediate recap for ${user.email} due to quiet hours.`,
          );
          continue; // Will be picked up by a batch job later
        }

        const html = await this.buildRecapHtml(meeting, preferences);

        await EmailService.sendMail({
          from: process.env.SENDER_EMAIL || "no-reply@meetonmemory.com",
          to: user.email,
          subject: `Meeting Recap: ${meeting.title}`,
          html,
        });

        // Mark as delivered
        await RecapDelivery.create({ meetingId, userId: user._id });
      }
    } catch (err) {
      console.error("[RecapEmailService] Error in sendImmediateRecap:", err);
    }
  }

  /**
   * Batch recaps for a specific user and timing
   */
  static async batchRecapsByUser(userId, timing) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const preferences = await RecapPreference.findOne({ userId });
      if (!preferences || preferences.deliveryTiming !== timing) return;

      if (this.isQuietHours(preferences)) return;

      // Find all meetings the user should get recaps for that haven't been delivered
      // We look for meetings uploaded by them or where they are a participant
      const recentMeetings = await Meeting.find({
        status: "completed",
        $or: [{ uploadedBy: user._id }, { "participants.email": user.email }],
      })
        .sort({ date: -1 })
        .limit(20);

      const undeliveredMeetings = [];
      for (const meeting of recentMeetings) {
        const delivered = await RecapDelivery.findOne({
          meetingId: meeting._id,
          userId: user._id,
        });
        if (!delivered) {
          undeliveredMeetings.push(meeting);
        }
      }

      if (undeliveredMeetings.length === 0) return;

      let html = `<div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333;">`;
      html += `<h2 style="color: #2563eb;">Your ${timing === "daily" ? "Daily" : "Weekly"} Meeting Digest</h2>`;
      html += `<p>You have ${undeliveredMeetings.length} new meeting recaps.</p>`;

      for (const meeting of undeliveredMeetings) {
        const recapHtml = await this.buildRecapHtml(meeting, preferences);
        html += `<div style="margin-bottom: 30px;">${recapHtml}</div>`;
      }

      html += `</div>`;

      await EmailService.sendMail({
        from: process.env.SENDER_EMAIL || "no-reply@meetonmemory.com",
        to: user.email,
        subject: `Your ${timing === "daily" ? "Daily" : "Weekly"} Meeting Recap Digest`,
        html,
      });

      // Mark all as delivered
      for (const meeting of undeliveredMeetings) {
        await RecapDelivery.create({
          meetingId: meeting._id,
          userId: user._id,
        });
      }
    } catch (err) {
      console.error(
        `[RecapEmailService] Error in batchRecapsByUser for ${userId}:`,
        err,
      );
    }
  }
}

export default RecapEmailService;
