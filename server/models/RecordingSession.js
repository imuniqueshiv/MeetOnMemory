import mongoose from "mongoose";

const failureItemSchema = new mongoose.Schema({
  reason: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  chunkIndex: {
    type: Number,
    default: 0,
  },
});

const recordingSessionSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
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
    status: {
      type: String,
      enum: ["IN_PROGRESS", "COMPLETED", "FAILED", "PAUSED"],
      default: "IN_PROGRESS",
      index: true,
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    chunkCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    failureReason: {
      type: String,
      default: null,
    },
    failureHistory: [failureItemSchema],
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    lastHeartbeatAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

// Helper method to determine if a session is stuck
recordingSessionSchema.methods.isStuck = function (thresholdMinutes = 10) {
  if (this.status !== "IN_PROGRESS") return false;
  const cutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);
  const lastActive = this.lastHeartbeatAt || this.updatedAt || this.startedAt;
  return lastActive < cutoff;
};

const RecordingSession = mongoose.model(
  "RecordingSession",
  recordingSessionSchema,
);

export default RecordingSession;
