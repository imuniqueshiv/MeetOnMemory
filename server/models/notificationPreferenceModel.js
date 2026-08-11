import mongoose from "mongoose";

/**
 * Per-user notification preferences.
 *
 * Issue #977: four of the original six toggles (`emailMeetingReminders`,
 * `emailTaskAssignments`, `emailWeeklyDigest`, `pushTaskAssignments`) were
 * writable through the API and rendered as working switches in the UI while
 * being read by absolutely nothing:
 *
 *     $ grep -rn "pushTaskAssignments" server --include="*.js"
 *     server/models/notificationPreferenceModel.js:28
 *     server/controllers/notificationController.js:231
 *
 * Only the schema and the allow-list. A switch that does nothing is worse than
 * no switch, because the user believes they've turned something off.
 *
 * The push toggles now genuinely gate delivery (see
 * `CATEGORY_TO_PREFERENCE` in services/notificationService.js). The three
 * `email*` toggles are retained — existing users have values stored against
 * them and the settings UI renders them — but they are documented here as not
 * yet enforced, so the gap is recorded in the schema rather than hidden.
 */
const notificationPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
      index: true,
    },

    // ── Email channel ────────────────────────────────────────────────────
    // NOT YET ENFORCED. The email paths (MeetingDigestService,
    // recapEmailService) do not consult these. Tracked as follow-up work;
    // documented rather than silently ignored.
    emailMeetingReminders: {
      type: Boolean,
      default: true,
    },
    emailTaskAssignments: {
      type: Boolean,
      default: true,
    },
    emailWeeklyDigest: {
      type: Boolean,
      default: false,
    },

    // ── In-app / push channel ────────────────────────────────────────────
    // All of these are enforced by notificationService.createNotifications.
    pushMeetingReminders: {
      type: Boolean,
      default: true,
    },
    pushTaskAssignments: {
      type: Boolean,
      default: true,
    },
    pushAiProcessingComplete: {
      type: Boolean,
      default: true,
    },
    pushOrganizationUpdates: {
      type: Boolean,
      default: true,
    },
    pushPolicyUpdates: {
      type: Boolean,
      default: true,
    },
    pushReportUpdates: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const NotificationPreference =
  mongoose.models.NotificationPreference ||
  mongoose.model("NotificationPreference", notificationPreferenceSchema);

export default NotificationPreference;
