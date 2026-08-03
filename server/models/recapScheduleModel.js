import mongoose from "mongoose";

const recapScheduleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    scheduleType: {
      type: String,
      enum: ["immediate", "daily", "weekly"],
      default: "immediate",
    },
    deliveryChannel: {
      type: String,
      enum: ["email", "webhook", "in_app"],
      default: "in_app",
    },
    preferredTime: {
      type: String,
      default: "09:00",
    },
    timezone: {
      type: String,
      default: "UTC",
    },
  },
  { timestamps: true },
);

recapScheduleSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

export default mongoose.model("RecapSchedule", recapScheduleSchema);
