import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import EmailService from "./EmailService.js";

class MeetingDigestService {
  /**
   * Constructs a responsive HTML email template for the meeting digest.
   * @param {Object} meeting - The meeting object containing details, summary, structuredMoM, etc.
   * @returns {string} - The HTML content for the email.
   */
  static buildDigestHtml(meeting) {
    const { title, date, summary, structuredMoM } = meeting;
    const meetingDate = new Date(date).toLocaleString();

    let decisionsHtml = "";
    if (structuredMoM?.decisions?.length > 0) {
      decisionsHtml = `
        <h3 style="color: #2563eb; margin-top: 20px;">Key Decisions</h3>
        <ul style="padding-left: 20px;">
          ${structuredMoM.decisions.map((d) => `<li style="margin-bottom: 8px;">${d}</li>`).join("")}
        </ul>
      `;
    }

    let actionItemsHtml = "";
    if (structuredMoM?.action_items?.length > 0) {
      actionItemsHtml = `
        <h3 style="color: #2563eb; margin-top: 20px;">Action Items</h3>
        <ul style="padding-left: 20px;">
          ${structuredMoM.action_items
            .map((ai) => {
              const owner = ai.owner || "Unassigned";
              const due = ai.due_date ? ` (Due: ${ai.due_date})` : "";
              return `<li style="margin-bottom: 8px;"><strong>${owner}</strong>: ${ai.task}${due}</li>`;
            })
            .join("")}
        </ul>
      `;
    }

    // Assuming frontend runs on standard port or use env var for base URL
    const appUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const meetingLink = `${appUrl}/meeting/${meeting._id}`;

    return `
      <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2563eb; margin-bottom: 5px;">Meeting Digest: ${title}</h2>
        <p style="color: #666; font-size: 14px; margin-top: 0;">${meetingDate}</p>
        
        ${
          summary
            ? `
          <h3 style="color: #2563eb; margin-top: 20px;">Summary</h3>
          <p style="line-height: 1.5;">${summary}</p>
        `
            : ""
        }
        
        ${decisionsHtml}
        ${actionItemsHtml}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${meetingLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">View Full Meeting Details</a>
        </div>
        
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 11px; color: #666; text-align: center;">
          This digest was sent automatically by MeetOnMemory. 
          You can update your email preferences in your account settings.
        </p>
      </div>
    `;
  }

  /**
   * Sends the meeting digest to all participants with email addresses who have not opted out.
   * @param {string} meetingId - The ID of the meeting.
   * @returns {Object} - Result of the operation.
   */
  static async sendMeetingDigest(meetingId) {
    try {
      const meeting = await Meeting.findById(meetingId);
      if (!meeting) {
        throw new Error("Meeting not found");
      }

      if (!meeting.participants || meeting.participants.length === 0) {
        return {
          success: false,
          message: "No participants found for this meeting.",
        };
      }

      // Filter participants who have an email address
      const participantsWithEmail = meeting.participants.filter(
        (p) => p.email && p.email.trim() !== "",
      );

      if (participantsWithEmail.length === 0) {
        return {
          success: false,
          message: "No participants with email addresses found.",
        };
      }

      // Get user opt-out status for these emails
      const emails = participantsWithEmail.map((p) => p.email);
      const users = await User.find(
        { email: { $in: emails } },
        "email emailDigestEnabled",
      );

      // Map email to emailDigestEnabled status
      const userPrefs = {};
      users.forEach((u) => {
        userPrefs[u.email] = u.emailDigestEnabled !== false; // defaults to true
      });

      // Filter recipients based on preferences (if user exists, respect preference; if user doesn't exist, send by default)
      const recipients = emails.filter((email) => userPrefs[email] !== false);

      if (recipients.length === 0) {
        return {
          success: false,
          message: "All participants with emails have opted out of digests.",
        };
      }

      const html = this.buildDigestHtml(meeting);
      const subject = `Meeting Digest: ${meeting.title}`;

      // Send emails
      for (const email of recipients) {
        await EmailService.sendMail({
          from: process.env.SENDER_EMAIL || "no-reply@meetonmemory.com",
          to: email,
          subject,
          html,
        });
      }

      return {
        success: true,
        message: `Digest sent to ${recipients.length} participant(s).`,
        recipientsSentTo: recipients.length,
      };
    } catch (error) {
      console.error("Error sending meeting digest:", error);
      return { success: false, message: error.message };
    }
  }
}

export default MeetingDigestService;
