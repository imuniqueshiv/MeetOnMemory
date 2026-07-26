import mongoose from "mongoose";

/**
 * versionSchema — snapshot of a policy at the time it was superseded.
 * Now stores AI-generated metadata so version history is meaningful.
 */
const versionSchema = new mongoose.Schema({
  name: String,
  version: String,
  fileUrl: String,
  commitMsg: { type: String, default: "" },
  summary: { type: String, default: "" },
  key_changes: [String],
  keywords: [String],
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    default: null,
  },
  createdAt: { type: Date, default: Date.now },
});

/**
 * policySchema — top-level policy document.
 * status tracks the processing lifecycle so the UI can display meaningful state.
 */
const policySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    version: { type: String, default: "1.0" },
    fileUrl: { type: String, required: true },

    // AI-generated content
    summary: { type: String, default: "" },
    key_changes: [String],
    keywords: [String],

    // Processing lifecycle: uploading → processing → ready | failed
    status: {
      type: String,
      enum: ["uploading", "processing", "ready", "failed"],
      default: "ready",
    },

    // Version control
    commitMsg: { type: String, default: "" },
    previousVersions: [versionSchema],

    // Identity
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },

    // Draft flag
    isDraft: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Indexes for query performance
policySchema.index({ organization: 1, createdAt: -1 });
policySchema.index({ status: 1 });

export default mongoose.model("Policy", policySchema);
