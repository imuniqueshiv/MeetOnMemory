import mongoose from "mongoose";

const notificationPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
      index: true,
    },
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
  },
  { timestamps: true },
);

const NotificationPreference =
  mongoose.models.NotificationPreference ||
  mongoose.model("NotificationPreference", notificationPreferenceSchema);

export default NotificationPreference;
