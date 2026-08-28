import mongoose from "mongoose";

const recurringActionItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    description: { type: String, default: "", maxlength: 2000 },
    owner: { type: String, default: "Unassigned" },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    meetingSeriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MeetingSeries",
      required: true,
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    recurrencePattern: {
      type: String,
      enum: ["daily", "weekly", "biweekly", "monthly"],
      required: true,
    },
    dayOfWeek: {
      type: Number, // 0 (Sunday) - 6 (Saturday)
      min: 0,
      max: 6,
      default: null,
    },
    dayOfMonth: {
      type: Number, // 1 - 31
      min: 1,
      max: 31,
      default: null,
    },
    time: {
      type: String, // "HH:MM"
      default: null,
    },
    currentStreak: {
      type: Number,
      default: 0,
    },
    highestStreak: {
      type: Number,
      default: 0,
    },
    totalCompleted: {
      type: Number,
      default: 0,
    },
    totalMissed: {
      type: Number,
      default: 0,
    },
    nextRunDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

recurringActionItemSchema.index({ organization: 1, isActive: 1 });
recurringActionItemSchema.index({ meetingSeriesId: 1 });

const RecurringActionItem =
  mongoose.models.RecurringActionItem ||
  mongoose.model("RecurringActionItem", recurringActionItemSchema);

export default RecurringActionItem;
