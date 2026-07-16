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

const actionItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    owner: { type: String, default: "Unassigned" },
    status: {
      type: String,
      enum: ["open", "in-progress", "resolved", "superseded"],
      default: "open",
    },
    sourceMeetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    embedding: {
      type: [Number],
      default: [],
    },

    relatesTo: {
      type: [relationshipSchema],
      default: [],
    },

    resolvedAt: {
      type: Date,
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
    feedbackScore: { type: Number, default: 0 }, // sum of ratings (1-5 each)
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
  },
  { timestamps: true },
);

const ActionItem =
  mongoose.models.ActionItem || mongoose.model("ActionItem", actionItemSchema);

export default ActionItem;
