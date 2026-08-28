import mongoose from "mongoose";

const meetingPulseCheckSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // We store this to prevent spamming, but we do NOT expose it to the organizer
    },
    signalType: {
      type: String,
      enum: ["weeds", "move_on", "break", "clarity"],
      required: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  },
);

// Index for fast time-series queries (fetching recent signals for a meeting)
meetingPulseCheckSchema.index({ meetingId: 1, createdAt: -1 });
meetingPulseCheckSchema.index({ meetingId: 1, signalType: 1, createdAt: -1 });

const MeetingPulseCheck = mongoose.model(
  "MeetingPulseCheck",
  meetingPulseCheckSchema,
);

export default MeetingPulseCheck;
