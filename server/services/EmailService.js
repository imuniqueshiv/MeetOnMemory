import transporter from "../config/nodeMailer.js";

class EmailService {
  /**
   * Send mail options using Nodemailer
   */
  static async sendMail(options) {
    try {
      await transporter.sendMail(options);
    } catch (err) {
      console.error(`Email delivery failed:`, err);
    }
  }

  /**
   * Send invitation email to user
   */
  static async sendInvitation({ to, organizationName, invitedBy, inviteLink }) {
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2563eb;">You're Invited!</h2>
        <p>Hi there,</p>
        <p><strong>${invitedBy}</strong> has invited you to join the organization <strong>${organizationName}</strong> on MeetOnMemory.</p>
        <p>Click the button below to view and accept or decline your invitation:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">View Invitation</a>
        </div>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 11px; color: #666;">This invitation was sent automatically. If you did not expect this, you can safely ignore this email.</p>
      </div>
    `;

    return this.sendMail({
      from: process.env.SENDER_EMAIL || "no-reply@meetonmemory.com",
      to,
      subject: `Invitation to join ${organizationName} on MeetOnMemory`,
      html,
    });
  }
}

export default EmailService;
