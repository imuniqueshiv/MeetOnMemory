import mongoose from "mongoose";

const annotationSchema = new mongoose.Schema({
  timestamp: {
    type: Number,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const meetingClipSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    startTime: {
      type: Number,
      required: true,
    },
    endTime: {
      type: Number,
      required: true,
    },
    transcriptSegments: [
      {
        text: String,
        speaker: String,
        speakerId: String,
        startTime: Number,
        endTime: Number,
      },
    ],
    labels: [
      {
        type: String,
      },
    ],
    annotations: [annotationSchema],
  },
  { timestamps: true },
);

// Indexes for query performance
meetingClipSchema.index({ meeting: 1, createdAt: -1 });
meetingClipSchema.index({ createdBy: 1, createdAt: -1 });

const MeetingClip = mongoose.model("MeetingClip", meetingClipSchema);
export default MeetingClip;
