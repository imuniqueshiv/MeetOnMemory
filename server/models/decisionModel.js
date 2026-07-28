import mongoose from "mongoose";

const relationshipSchema = new mongoose.Schema(
  {
    target: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Decision",
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
    owner: { type: String, default: "" },
    status: { type: String, default: "open" },
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

const decisionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    owner: { type: String, default: "" },
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
    embedding: { type: [Number], default: [] },

    relatesTo: {
      type: [relationshipSchema],
      default: [],
    },

    resolvedAt: { type: Date, default: null },

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
    // --- Memory Consolidation fields ---
    // Alternate phrasings that were detected as duplicates/paraphrases of
    // this canonical memory and folded into it.
    aliases: { type: [String], default: [] },
    // Full history of duplicate records merged into this canonical memory.
    mergedFrom: { type: [mergeHistorySchema], default: [] },
    // Conflicting field values encountered during consolidation and how
    // they were resolved.
    mergeConflicts: { type: [mergeConflictSchema], default: [] },
    // If this record was itself merged away into another canonical memory,
    // this points to that canonical record. Non-canonical records are kept
    // (not deleted) so relationships/history remain traceable.
    supersededByMemory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Decision",
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
    // When set, the sweep may permanently delete this memory once past
    // this timestamp (only ever reached from the "archived" state).
    expiresAt: { type: Date, default: null },
    lifecycleHistory: { type: [lifecycleTransitionSchema], default: [] },
  },
  { timestamps: true },
);

const Decision =
  mongoose.models.Decision || mongoose.model("Decision", decisionSchema);
export default Decision;
