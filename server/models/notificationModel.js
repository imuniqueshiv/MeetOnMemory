// server/models/notificationModel.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: [
        "meetings",
        // Issue #977: action-item reminders were filed under "meetings", so
        // `pushTaskAssignments` governed nothing and `pushMeetingReminders`
        // silently killed task reminders. They now have their own category.
        "tasks",
        "ai_processing",
        "organizations",
        "policies",
        "reports",
        "system",
      ],
      default: "system",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    actionUrl: {
      type: String,
      default: "",
    },
    actionLabel: {
      type: String,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

// ─── Retention (Issue #977) ──────────────────────────────────────────────────
// Nothing ever deleted a notification, so the collection grew without bound for
// the lifetime of the deployment. A TTL index reaps them automatically.
//
// The index is on `createdAt` with a single global expiry rather than a
// per-document one, because MongoDB's TTL monitor only supports a fixed
// `expireAfterSeconds` per index. Reaping by age (not by read state) is the
// safer rule: an unread notification that is a year old is not going to be
// acted on, and keeping it forever to avoid "losing" it is what caused the
// unbounded growth in the first place.
//
// Configurable so an organization with compliance requirements can extend it.
const RETENTION_DAYS = (() => {
  const parsed = Number.parseInt(process.env.NOTIFICATION_RETENTION_DAYS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 90;
})();

notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 },
);

const notificationModel =
  mongoose.models.notification ||
  mongoose.model("notification", notificationSchema);

export default notificationModel;
