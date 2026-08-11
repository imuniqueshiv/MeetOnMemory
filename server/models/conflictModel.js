import mongoose from "mongoose";

// One pairwise contradiction found within a conflict set. A set can hold
// more than one pair when 3+ memories transitively conflict (A vs B, B vs
// C), mirroring how Memory Consolidation clusters transitive duplicates.
const pairwiseConflictSchema = new mongoose.Schema(
  {
    memberA: { type: mongoose.Schema.Types.ObjectId, required: true },
    memberB: { type: mongoose.Schema.Types.ObjectId, required: true },
    confidence: { type: Number, min: 0, max: 100, required: true },
    signals: { type: [mongoose.Schema.Types.Mixed], default: [] },
    explanation: { type: String, default: "" },
    source: {
      type: String,
      enum: ["heuristic", "ai"],
      default: "heuristic",
    },
  },
  { _id: false },
);

// Snapshot of a member's text/owner/status at detection time, so the
// resolution UI (and audit trail) can show what each side actually said
// even after the underlying memory is later edited or superseded.
const memberSnapshotSchema = new mongoose.Schema(
  {
    memoryId: { type: mongoose.Schema.Types.ObjectId, required: true },
    text: { type: String, required: true },
    owner: { type: String, default: "" },
    status: { type: String, default: "" },
    sourceMeetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
    },
    capturedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const conflictSetSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    // "decision" | "actionItem" — matches consolidationRegistry's MODEL_REGISTRY keys.
    modelType: {
      type: String,
      enum: ["decision", "actionItem"],
      required: true,
    },
    // The memories involved in this conflict, most-confident-signal first.
    memberIds: {
      type: [mongoose.Schema.Types.ObjectId],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 2,
        message: "A conflict set needs at least two members.",
      },
    },
    memberSnapshots: { type: [memberSnapshotSchema], default: [] },
    pairwiseConflicts: { type: [pairwiseConflictSchema], default: [] },

    // Highest pairwise confidence in the set — used for sorting/triage.
    confidence: { type: Number, min: 0, max: 100, default: 0 },

    // Human-readable, AI-or-heuristic-generated summary of *why* this
    // group was flagged, shown directly in the resolution UI.
    explanation: { type: String, default: "" },

    status: {
      type: String,
      enum: ["open", "resolved", "dismissed"],
      default: "open",
      index: true,
    },

    resolution: {
      type: {
        type: String,
        enum: ["kept_member", "custom_value", "dismissed"],
        default: null,
      },
      // If type === "kept_member", the memory that was chosen as correct.
      keptMemoryId: { type: mongoose.Schema.Types.ObjectId, default: null },
      // If type === "custom_value", the free-text resolution the user entered.
      customValue: { type: String, default: "" },
      note: { type: String, default: "" },
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      resolvedAt: { type: Date, default: null },
    },

    detectedAt: { type: Date, default: Date.now },
    lastScannedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// A given pair of memories should only ever have one *open* conflict set,
// even across repeated background scans — findOpenConflictForMembers
// relies on this index for a fast existence check.
conflictSetSchema.index({ organization: 1, modelType: 1, status: 1 });
conflictSetSchema.index({ memberIds: 1, status: 1 });

const ConflictSet =
  mongoose.models.ConflictSet ||
  mongoose.model("ConflictSet", conflictSetSchema);

export default ConflictSet;
