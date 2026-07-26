import mongoose from "mongoose";

// A single node as it existed at snapshot time. Deliberately slim compared
// to the live Decision/ActionItem documents — only the fields that matter
// for rendering and diffing a historical graph are kept, so snapshots stay
// cheap to store even as the graph grows.
const snapshotNodeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // e.g. "decision:<id>"
    type: { type: String, required: true }, // decision | actionItem | meeting
    refId: { type: mongoose.Schema.Types.ObjectId, required: true },
    text: { type: String, default: "" },
    owner: { type: String, default: "" },
    status: { type: String, default: "" },
    sourceMeetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
    },
    createdAt: { type: Date, default: null },
  },
  { _id: false },
);

const snapshotEdgeSchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    target: { type: String, required: true },
    weight: { type: Number, default: 0 },
  },
  { _id: false },
);

const graphSnapshotSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },

    // What caused this snapshot to be captured. "meeting_processed" is the
    // automatic trigger fired once a meeting's decisions/action items have
    // been merged into the graph; "manual" and "scheduled" cover the other
    // configurable triggers called out in the issue.
    trigger: {
      type: String,
      enum: ["meeting_processed", "manual", "scheduled", "consolidation"],
      required: true,
    },
    sourceMeetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
    },
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Deduplication key: a hash of the (sorted) node/edge content. If a new
    // capture hashes identically to the organization's latest snapshot, the
    // service skips writing a duplicate row entirely — this is the primary
    // storage-efficiency mechanism called out in the issue's acceptance
    // criteria, and it's far simpler/cheaper than diff-encoding every write.
    contentHash: { type: String, required: true, index: true },

    nodes: { type: [snapshotNodeSchema], default: [] },
    edges: { type: [snapshotEdgeSchema], default: [] },

    metadata: {
      nodeCount: { type: Number, default: 0 },
      edgeCount: { type: Number, default: 0 },
      decisionCount: { type: Number, default: 0 },
      actionItemCount: { type: Number, default: 0 },
      meetingCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

// Primary access pattern: "give me organization X's snapshots, newest first"
graphSnapshotSchema.index({ organization: 1, createdAt: -1 });
// Fast "is this identical to the last capture" lookup, scoped per org.
graphSnapshotSchema.index({ organization: 1, contentHash: 1 });

export default mongoose.model("GraphSnapshot", graphSnapshotSchema);
