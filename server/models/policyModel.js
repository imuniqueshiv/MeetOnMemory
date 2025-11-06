import mongoose from "mongoose";

const versionSchema = new mongoose.Schema({
  name: String,
  version: String,
  fileUrl: String,
  commitMsg: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

const policySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    version: { type: String, default: "1.0" },
    fileUrl: { type: String, required: true },
    summary: { type: String, default: "" },
    key_changes: [String],
    keywords: [String],
    commitMsg: { type: String, default: "" },
    previousVersions: [versionSchema],
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("Policy", policySchema);
