import cron from "node-cron";
import StandupPreference from "../models/standupPreferenceModel.js";
import User from "../models/userModel.js";
import { generateStandupReport } from "../services/standupReportService.js";
import EmailService from "../services/EmailService.js";
import { sendSlackNotification } from "../services/slackService.js";

let isInitialized = false;
let standupReportTask = null;

/**
 * Deliver a generated standup report via configured delivery channels (email, slack).
 * @param {object} pref - StandupPreference document or object
 * @param {object} report - Generated StandupReport document
 */
export const deliverStandupReport = async (pref, report) => {
  if (!pref || !report) return;

  const channels = pref.deliveryChannels || [];
  if (!Array.isArray(channels) || channels.length === 0) return;

  let user = null;
  if (channels.includes("email") || channels.includes("slack")) {
    try {
      user = await User.findById(pref.user);
    } catch (userErr) {
      console.error(
        `[StandupReportJob] Failed to fetch user ${pref.user} for delivery:`,
        userErr.message,
      );
    }
  }

  // 1. Email Delivery
  if (channels.includes("email")) {
    try {
      if (user?.email) {
        const scheduleLabel =
          pref.scheduleType === "weekly" ? "Weekly" : "Daily";
        const title = `[Standup Report] ${scheduleLabel} Standup Report`;
        let description =
          report.aiSummary || "Your standup report has been generated.";

        if (
          Array.isArray(report.completedActionItems) &&
          report.completedActionItems.length > 0
        ) {
          description +=
            "\n\nCompleted Items:\n" +
            report.completedActionItems.map((i) => `- ${i.text}`).join("\n");
        }
        if (
          Array.isArray(report.upcomingActionItems) &&
          report.upcomingActionItems.length > 0
        ) {
          description +=
            "\n\nUpcoming Items:\n" +
            report.upcomingActionItems.map((i) => `- ${i.text}`).join("\n");
        }
        if (Array.isArray(report.blockers) && report.blockers.length > 0) {
          description +=
            "\n\nBlockers:\n" +
            report.blockers.map((i) => `- ${i.text}`).join("\n");
        }

        await EmailService.sendNotificationEmail(
          user.email,
          title,
          description,
        );
        console.log(
          `[StandupReportJob] Email report delivered to ${user.email} for report ${report._id}`,
        );
      } else {
        console.warn(
          `[StandupReportJob] User ${pref.user} missing email address for email delivery`,
        );
      }
    } catch (emailErr) {
      console.error(
        `[StandupReportJob] Failed email delivery for user ${pref.user}:`,
        emailErr.message,
      );
    }
  }

  // 2. Slack Delivery
  if (channels.includes("slack")) {
    try {
      if (pref.organization) {
        const scheduleLabel =
          pref.scheduleType === "weekly" ? "Weekly" : "Daily";
        const userName = user?.displayName || user?.name || "User";
        const title = `${scheduleLabel} Standup Report for ${userName}`;
        let message = `*${title}*\n\n${report.aiSummary || ""}`;

        if (
          Array.isArray(report.completedActionItems) &&
          report.completedActionItems.length > 0
        ) {
          message +=
            "\n\n*Completed Items:*\n" +
            report.completedActionItems.map((i) => `• ${i.text}`).join("\n");
        }
        if (
          Array.isArray(report.upcomingActionItems) &&
          report.upcomingActionItems.length > 0
        ) {
          message +=
            "\n\n*Upcoming Items:*\n" +
            report.upcomingActionItems.map((i) => `• ${i.text}`).join("\n");
        }
        if (Array.isArray(report.blockers) && report.blockers.length > 0) {
          message +=
            "\n\n*Blockers:*\n" +
            report.blockers.map((i) => `• ${i.text}`).join("\n");
        }

        await sendSlackNotification(pref.organization, message);
        console.log(
          `[StandupReportJob] Slack report delivered to org ${pref.organization} for report ${report._id}`,
        );
      } else {
        console.warn(
          `[StandupReportJob] Preference for user ${pref.user} missing organization for Slack delivery`,
        );
      }
    } catch (slackErr) {
      console.error(
        `[StandupReportJob] Failed Slack delivery for org ${pref.organization}:`,
        slackErr.message,
      );
    }
  }
};

export const startStandupReportJob = () => {
  if (isInitialized) {
    console.warn("⚠️ StandupReportJob already initialized");
    return;
  }

  // Runs every hour to check for preferences that match the current hour
  standupReportTask = cron.schedule("0 * * * *", async () => {
    console.log("[StandupReportJob] Checking for due standup reports...");
    try {
      const currentHour = new Date().getHours().toString().padStart(2, "0"); // "00" to "23"

      // We will look for preferences where timeOfDay roughly matches the current hour.
      // E.g. "09:00" -> hour 09
      const prefs = await StandupPreference.find({
        scheduleType: { $in: ["daily", "weekly"] },
        timeOfDay: { $regex: `^${currentHour}:` },
      });

      for (const pref of prefs) {
        try {
          const now = new Date();
          // If weekly, only run on Monday (1)
          if (pref.scheduleType === "weekly" && now.getDay() !== 1) {
            continue;
          }

          const endDate = new Date();
          const startDate = new Date();
          if (pref.scheduleType === "daily") {
            startDate.setDate(startDate.getDate() - 1);
          } else {
            startDate.setDate(startDate.getDate() - 7);
          }

          const report = await generateStandupReport(
            pref.user,
            pref.organization,
            pref.scheduleType,
            startDate,
            endDate,
          );

          console.log(
            `[StandupReportJob] Generated report for user ${pref.user} in org ${pref.organization}`,
          );

          await deliverStandupReport(pref, report);
        } catch (prefErr) {
          console.error(
            `[StandupReportJob] Error generating report for user ${pref.user}:`,
            prefErr,
          );
        }
      }
      console.log(
        "[StandupReportJob] Due standup reports generation completed.",
      );
    } catch (err) {
      console.error("[StandupReportJob] Error in standup report job:", err);
    }
  });

  isInitialized = true;
  console.log("✅ StandupReportJob scheduled (hourly)");
};

export const stopStandupReportJob = () => {
  if (standupReportTask) {
    standupReportTask.stop();
    standupReportTask = null;
  }
  isInitialized = false;
  console.log("StandupReportJob stopped");
};

export default startStandupReportJob;
