import userModel from "../models/userModel.js";
import membershipModel from "../models/membershipModel.js";
import Meeting from "../models/meetingModel.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import transporter from "../config/nodeMailer.js";
import eventBus from "../services/eventBus.js";
import auditLogExportJob from "./auditLogExportJob.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SENSITIVE_USER_FIELDS = [
  "password",
  "verifyOtp",
  "verifyOtpExpireAt",
  "resetOtp",
  "resetOtpExpireAt",
  "resetPasswordToken",
  "resetPasswordExpires",
  "otp",
  "otpExpires",
  "googleAccessToken",
  "googleRefreshToken",
  "googleId",
  "__v",
];

export const sanitizeUserForExport = (user) => {
  if (!user) return null;
  const sanitized = { ...user };
  for (const field of SENSITIVE_USER_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
};

export default async function exportDataJob(job, _app) {
  if (job.name === "audit-log-export") return auditLogExportJob(job);
  const { userId, email } = job.data;
  console.log(`📦 Starting data export for user ${userId}...`);

  try {
    // Fetch User Data
    const userRaw = await userModel
      .findById(userId)
      .select(
        "-password -verifyOtp -verifyOtpExpireAt -resetOtp -resetOtpExpireAt -googleAccessToken -googleRefreshToken",
      )
      .lean();
    if (!userRaw) throw new Error("User not found");

    const user = sanitizeUserForExport(userRaw);

    // Fetch Meetings
    const meetings = await Meeting.find({ uploadedBy: userId }).lean();

    // Fetch Memberships
    const memberships = await membershipModel.find({ user: userId }).lean();

    const exportDir = path.join(__dirname, "..", "uploads", "exports");
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const fileName = `export_${userId}_${Date.now()}.zip`;
    const filePath = path.join(exportDir, fileName);

    // archiver v8+ is a pure ES Module — must be loaded via dynamic import()
    const { default: archiver } = await import("archiver");

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(filePath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", resolve);
      archive.on("error", reject);
      archive.on("warning", (err) => {
        if (err.code === "ENOENT") console.warn(err);
        else reject(err);
      });

      archive.pipe(output);
      archive.append(JSON.stringify(user, null, 2), {
        name: "user_profile.json",
      });
      archive.append(JSON.stringify(meetings, null, 2), {
        name: "meetings.json",
      });
      archive.append(JSON.stringify(memberships, null, 2), {
        name: "memberships.json",
      });
      archive.finalize();
    });

    console.log(`✅ Data export for user ${userId} saved to ${filePath}`);

    // Generate Secure Download Link
    const jwtSecret = process.env.JWT_SECRET;
    const downloadToken = jwt.sign({ userId, fileName }, jwtSecret, {
      expiresIn: "24h",
    });

    // In production, BASE_URL should be configured correctly in .env
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const downloadUrl = `${baseUrl}/api/user/download-export/${downloadToken}`;

    // Send Email
    const mailOptions = {
      from: process.env.SMTP_USER || "no-reply@meetonmemory.com",
      to: email,
      subject: "Your Data Export is Ready",
      html: `
        <h2>Data Export Completed</h2>
        <p>Your requested data export is ready. You can download it using the link below:</p>
        <p><a href="${downloadUrl}">Download Data Export</a></p>
        <p><strong>Note:</strong> This link will expire in 24 hours.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Notification email sent to ${email}`);

    eventBus.emit("export.ready", { userId, downloadUrl });

    return { success: true, fileName };
  } catch (error) {
    console.error(`❌ Data export failed for user ${userId}:`, error.message);
    throw error;
  }
}
