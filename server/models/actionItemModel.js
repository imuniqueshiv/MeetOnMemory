import mongoose from "mongoose";

const relationshipSchema = new mongoose.Schema(
  {
    target: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ActionItem",
      required: true,
    },
    confidence: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    computedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

// Snapshot of a memory that was folded into a canonical record during
// consolidation. Preserves the exact wording/metadata that existed at
// merge time so history is never silently lost.
const mergeHistorySchema = new mongoose.Schema(
  {
    originalId: { type: mongoose.Schema.Types.ObjectId, required: true },
    text: { type: String, required: true },
    owner: { type: String, default: "Unassigned" },
    status: { type: String, default: "open" },
    dueDate: { type: Date, default: null },
    sourceMeetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
    },
    mergedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// Records a field-level disagreement discovered between merged duplicates,
// and how the consolidation engine resolved it, for auditability.
const mergeConflictSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    values: { type: [mongoose.Schema.Types.Mixed], default: [] },
    resolution: { type: String, default: "" },
    resolvedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// One entry per lifecycle state transition (Issue #377), so every
// archive/restore/expiry decision made by the sweep (or an admin) is
// traceable after the fact without needing a separate AuditLog lookup.
const lifecycleTransitionSchema = new mongoose.Schema(
  {
    from: { type: String, default: null },
    to: { type: String, required: true },
    reason: { type: String, default: "" },
    // "system" for scheduled sweep transitions, otherwise the acting user id.
    triggeredBy: { type: String, default: "system" },
    transitionedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const actionItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    description: { type: String, default: "", maxlength: 2000 },
    owner: { type: String, default: "Unassigned" },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: [
        "open",
        "in-progress",
        "resolved",
        "superseded",
        "pending",
        "in_progress",
        "completed",
        "overdue",
        "cancelled",
      ],
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    sourceMeetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    sourceContext: {
      type: String,
      default: "",
    },
    remindersEnabled: {
      type: Boolean,
      default: true,
    },
    reminderSent: {
      upcoming: { type: Boolean, default: false },
      overdue: { type: Boolean, default: false },
      upcomingSentAt: { type: Date, default: null },
      overdueSentAt: { type: Date, default: null },
    },
    remindersSent: [
      {
        type: {
          type: String,
          enum: ["7_day", "3_day", "1_day", "due_today", "overdue"],
        },
        sentAt: { type: Date, default: Date.now },
      },
    ],
    aiConfidence: {
      type: Number,
      default: 1.0,
    },
    embedding: {
      type: [Number],
      default: [],
    },

    relatesTo: {
      type: [relationshipSchema],
      default: [],
    },

    recurringActionItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RecurringActionItem",
      default: null,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    // --- GitHub Integration ---
    externalGitHubIssueId: {
      type: Number,
      default: null,
    },
    externalGitHubIssueUrl: {
      type: String,
      default: null,
    },

    // --- Jira Integration ---
    externalJiraIssueId: {
      type: String,
      default: null,
    },
    externalJiraIssueUrl: {
      type: String,
      default: null,
    },

    // --- Linear Integration ---
    externalLinearIssueId: {
      type: String,
      default: null,
    },
    externalLinearIssueUrl: {
      type: String,
      default: null,
    },

    resolvedInMeetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
    },

    // --- Dynamic memory importance scoring (Issue #269) ---
    accessCount: { type: Number, default: 0 },
    lastAccessedAt: { type: Date, default: null },
    feedbackScore: { type: Number, default: 0 },
    feedbackCount: { type: Number, default: 0 },
    importanceScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    importanceFactors: {
      accessFrequency: { type: Number, default: 0 },
      recency: { type: Number, default: 0 },
      graphDegree: { type: Number, default: 0 },
      aiConfidence: { type: Number, default: 0 },
      userFeedback: { type: Number, default: 0 },
    },
    importanceUpdatedAt: { type: Date, default: null },

    // --- Memory Consolidation fields ---
    aliases: { type: [String], default: [] },
    mergedFrom: { type: [mergeHistorySchema], default: [] },
    mergeConflicts: { type: [mergeConflictSchema], default: [] },
    supersededByMemory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ActionItem",
      default: null,
    },
    lastConsolidatedAt: { type: Date, default: null },

    // --- Memory Lifecycle Management (Issue #377) ---
    lifecycleState: {
      type: String,
      enum: ["active", "dormant", "archived", "expired"],
      default: "active",
      index: true,
    },
    lifecycleUpdatedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    lifecycleHistory: { type: [lifecycleTransitionSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual aliases for compatibility across all ActionItem services and controllers
actionItemSchema
  .virtual("title")
  .get(function () {
    return this.text;
  })
  .set(function (val) {
    this.text = val;
  });

actionItemSchema
  .virtual("meetingId")
  .get(function () {
    return this.sourceMeetingId;
  })
  .set(function (val) {
    this.sourceMeetingId = val;
  });

actionItemSchema
  .virtual("deadline")
  .get(function () {
    return this.dueDate;
  })
  .set(function (val) {
    this.dueDate = val;
  });

actionItemSchema.index({ organization: 1, status: 1, createdAt: -1 });
actionItemSchema.index({ organization: 1, dueDate: 1 });
actionItemSchema.index({ organization: 1, owner: 1 });
actionItemSchema.index({ assignee: 1, status: 1 });
actionItemSchema.index({ deadline: 1, status: 1 });

const ActionItem =
  mongoose.models.ActionItem || mongoose.model("ActionItem", actionItemSchema);

export default ActionItem;
