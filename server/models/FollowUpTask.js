import mongoose from "mongoose";

/**
 * FollowUpTask Schema
 * Tracks action items from meetings with automated follow-up workflows,
 * reminders, escalations, and completion tracking
 */

const reminderSchema = new mongoose.Schema({
  scheduledFor: {
    type: Date,
    required: true,
  },
  sent: {
    type: Boolean,
    default: false,
  },
  sentAt: {
    type: Date,
    default: null,
  },
  type: {
    type: String,
    enum: [
      "pre-deadline-24h",
      "pre-deadline-12h",
      "pre-deadline-1h",
      "overdue",
      "escalation",
    ],
    required: true,
  },
  channel: {
    type: String,
    enum: ["email", "in-app", "slack"],
    default: "in-app",
  },
});

const escalationSchema = new mongoose.Schema({
  escalatedAt: {
    type: Date,
    default: Date.now,
  },
  escalatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 3,
  },
});

const metadataSchema = new mongoose.Schema(
  {
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    estimatedHours: {
      type: Number,
      min: 0,
      default: null,
    },
    actualHours: {
      type: Number,
      min: 0,
      default: null,
    },
    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FollowUpTask",
      },
    ],
    tags: [String],
    notes: String,
  },
  { _id: false },
);

const followUpTaskSchema = new mongoose.Schema(
  {
    actionItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ActionItem",
      required: true,
      index: true,
    },
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    deadline: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "overdue", "cancelled"],
      default: "pending",
      index: true,
    },
    acknowledged: {
      type: Boolean,
      default: false,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reminders: {
      type: [reminderSchema],
      default: [],
    },
    escalations: {
      type: [escalationSchema],
      default: [],
    },
    metadata: {
      type: metadataSchema,
      default: () => ({}),
    },
    reminderPreferences: {
      preDeadline24h: { type: Boolean, default: true },
      preDeadline12h: { type: Boolean, default: true },
      preDeadline1h: { type: Boolean, default: true },
      overdueAlerts: { type: Boolean, default: true },
      escalationEnabled: { type: Boolean, default: true },
    },
    followUpMeeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
    },
    lastRemindedAt: {
      type: Date,
      default: null,
    },
    reminderCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient queries
followUpTaskSchema.index({ assignee: 1, status: 1, deadline: 1 });
followUpTaskSchema.index({ organization: 1, status: 1 });
followUpTaskSchema.index({ "reminders.scheduledFor": 1, "reminders.sent": 1 });
followUpTaskSchema.index({ deadline: 1, status: 1 });

// Virtual for time until deadline
followUpTaskSchema.virtual("timeUntilDeadline").get(function () {
  if (!this.deadline) return null;
  const now = new Date();
  const diff = this.deadline.getTime() - now.getTime();
  return Math.max(0, diff);
});

// Virtual for is overdue
followUpTaskSchema.virtual("isOverdue").get(function () {
  if (this.status === "completed" || this.status === "cancelled") return false;
  return new Date() > this.deadline;
});

// Pre-save hook to update status to overdue
followUpTaskSchema.pre("save", function (next) {
  if (
    this.status !== "completed" &&
    this.status !== "cancelled" &&
    new Date() > this.deadline
  ) {
    this.status = "overdue";
  }
  next();
});

// Method to schedule reminders
followUpTaskSchema.methods.scheduleReminders = function () {
  const reminders = [];
  const prefs = this.reminderPreferences;

  if (prefs.preDeadline24h) {
    reminders.push({
      scheduledFor: new Date(this.deadline.getTime() - 24 * 60 * 60 * 1000),
      type: "pre-deadline-24h",
      sent: false,
    });
  }

  if (prefs.preDeadline12h) {
    reminders.push({
      scheduledFor: new Date(this.deadline.getTime() - 12 * 60 * 60 * 1000),
      type: "pre-deadline-12h",
      sent: false,
    });
  }

  if (prefs.preDeadline1h) {
    reminders.push({
      scheduledFor: new Date(this.deadline.getTime() - 1 * 60 * 60 * 1000),
      type: "pre-deadline-1h",
      sent: false,
    });
  }

  this.reminders = reminders;
  return this.save();
};

// Method to mark as completed
followUpTaskSchema.methods.markCompleted = function (userId) {
  this.status = "completed";
  this.completedAt = new Date();
  this.completedBy = userId;
  return this.save();
};

// Method to acknowledge assignment
followUpTaskSchema.methods.acknowledge = function () {
  this.acknowledged = true;
  this.acknowledgedAt = new Date();
  return this.save();
};

// Method to escalate
followUpTaskSchema.methods.escalate = function (
  escalatedTo,
  reason,
  level = 1,
) {
  this.escalations.push({
    escalatedAt: new Date(),
    escalatedTo,
    reason,
    level,
  });
  return this.save();
};

const FollowUpTask = mongoose.model("FollowUpTask", followUpTaskSchema);

export default FollowUpTask;
