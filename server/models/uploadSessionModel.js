import mongoose from "mongoose";

const uploadSessionSchema = new mongoose.Schema(
  {
    uploadId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    totalChunks: {
      type: Number,
      required: true,
    },
    uploadedChunks: {
      type: [Number],
      default: [],
    },
    status: {
      type: String,
      enum: ["in_progress", "completed", "failed", "aborted"],
      default: "in_progress",
      index: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      title: { type: String, default: "" },
      date: { type: String, default: "" },
      tags: { type: [String], default: [] },
    },
  },
  {
    timestamps: true,
  },
);

const UploadSession =
  mongoose.models.UploadSession ||
  mongoose.model("UploadSession", uploadSessionSchema);

export default UploadSession;
