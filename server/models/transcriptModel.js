import mongoose from "mongoose";

const transcriptSegmentSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  speaker: {
    type: String,
    required: true,
  },
  speakerId: {
    type: String,
    default: null,
  },
  startTime: {
    type: Number,
    required: true,
  },
  endTime: {
    type: Number,
    required: true,
  },
  confidence: {
    type: Number,
    default: 1.0,
  },
  isFinal: {
    type: Boolean,
    default: false,
  },
  sentimentScore: {
    type: Number,
    default: 0,
  },
  emotionTags: {
    type: [String],
    default: [],
  },
});

const transcriptSchema = new mongoose.Schema(
  {
    // Canonical meeting reference used by all controllers/sockets/exports.
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    // Optional denormalized org id for indexing/search filters.
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    segments: [transcriptSegmentSchema],
    fullText: {
      type: String,
      default: "",
    },
    // "active" retained for backward compatibility with older live-chunk docs.
    // Recording flow uses "recording" → "processing" → "completed"|"failed".
    status: {
      type: String,
      enum: ["active", "recording", "processing", "completed", "failed"],
      default: "active",
    },
    audioFilePath: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    recordingTimestamps: {
      recordingStartedAt: { type: Date },
      recordingEndedAt: { type: Date },
      processingStartedAt: { type: Date },
      completedAt: { type: Date },
    },
    duration: {
      type: Number,
      default: 0,
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    language: {
      type: String,
      default: "en",
    },
    overallSentiment: {
      type: Number,
      default: 0,
    },
    overallEmotion: {
      type: String,
      default: "NEUTRAL",
    },
  },
  { timestamps: true },
);

// Indexes for query performance
transcriptSchema.index({ meeting: 1 });
transcriptSchema.index({ status: 1 });
transcriptSchema.index({ createdAt: -1 });

const Transcript = mongoose.model("Transcript", transcriptSchema);
export default Transcript;
