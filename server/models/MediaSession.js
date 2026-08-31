const mongoose = require("mongoose");

const TrackSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    kind: { type: String, enum: ["audio", "video"], required: true },
    type: { type: String, enum: ["camera", "screen", "mic"], required: true },
  },
  { _id: false },
);

const ParticipantSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  socketId: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date },
  tracks: [TrackSchema],
});

const MediaSessionSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    participants: [ParticipantSchema],
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    bandwidthUsage: {
      bytesSent: { type: Number, default: 0 },
      bytesReceived: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["active", "ended"],
      default: "active",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("MediaSession", MediaSessionSchema);
