import mongoose from "mongoose";

const meetingFeedbackSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    overallRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    summaryAccuracy: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    transcriptQuality: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: "",
    },
    tags: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true },
);

// Compound unique index so one user can only leave one feedback per meeting
meetingFeedbackSchema.index({ meetingId: 1, userId: 1 }, { unique: true });

// Index for getting aggregate feedback for an organization sorted by date
meetingFeedbackSchema.index({ organization: 1, createdAt: -1 });

export default mongoose.model("MeetingFeedback", meetingFeedbackSchema);
