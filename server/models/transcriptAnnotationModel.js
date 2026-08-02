import mongoose from "mongoose";

const transcriptAnnotationSchema = new mongoose.Schema(
  {
    transcript: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transcript",
      required: true,
    },
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["comment", "highlight", "flag"],
      required: true,
    },
    body: {
      type: String,
      required: function () {
        return this.type === "comment" || this.type === "flag";
      },
    },
    color: {
      type: String,
      default: "#fbbf24", // Default highlight color
    },
    startTime: {
      type: Number,
      required: true,
    },
    endTime: {
      type: Number,
      required: true,
    },
    segmentIndex: {
      type: Number,
      default: null,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Indexes for query performance
transcriptAnnotationSchema.index({ transcript: 1, startTime: 1 });

const TranscriptAnnotation = mongoose.model(
  "TranscriptAnnotation",
  transcriptAnnotationSchema,
);
export default TranscriptAnnotation;
