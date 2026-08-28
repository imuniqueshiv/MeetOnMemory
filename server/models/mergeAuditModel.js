import mongoose from "mongoose";

/**
 * Records every meeting merge operation for auditability and rollback (Issue #1601).
 *
 * Stores the minimal snapshot needed to reverse a merge: the secondary meeting's
 * key fields, the IDs of re-parented child documents, and the merge metadata.
 */
const mergeAuditSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    primaryMeeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    secondaryMeeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    mergedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    confidence: {
      type: Number,
      default: null,
    },
    reason: {
      type: String,
      default: "",
    },
    snapshot: {
      secondaryTitle: String,
      secondaryDate: Date,
      secondaryTranscript: String,
      secondaryParticipants: [mongoose.Schema.Types.Mixed],
      reparentedActionItems: [mongoose.Schema.Types.ObjectId],
      reparentedKeyMoments: [mongoose.Schema.Types.ObjectId],
      reparentedComments: { type: Number, default: 0 },
      reparentedAttachments: { type: Number, default: 0 },
      reparentedDecisions: { type: Number, default: 0 },
      reparentedFollowUpTasks: { type: Number, default: 0 },
      mergedTranscriptSegmentIds: [mongoose.Schema.Types.ObjectId],

      // Issue #2260: preserve primary values that were replaced by a
      // field-level merge choice so rollback can restore them.
      primaryFieldValues: {
        title: { type: String, default: null },
        time: { type: String, default: null },
        date: { type: Date, default: null },
        participants: [mongoose.Schema.Types.Mixed],
        summary: { type: String, default: null },
        tags: [String],
      },
      fieldSelections: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    rolledBack: {
      type: Boolean,
      default: false,
    },
    rolledBackAt: {
      type: Date,
      default: null,
    },
    rolledBackBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

mergeAuditSchema.index({ primaryMeeting: 1, secondaryMeeting: 1 });

const MergeAudit =
  mongoose.models.MergeAudit || mongoose.model("MergeAudit", mergeAuditSchema);

export default MergeAudit;
