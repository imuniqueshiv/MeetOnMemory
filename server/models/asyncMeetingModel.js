import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  answers: [
    {
      question: { type: String, required: true },
      answer: { type: String, required: true },
    },
  ],
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

const asyncMeetingSchema = new mongoose.Schema(
  {
    originalMeetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    template: [
      {
        type: String,
        required: true,
      },
    ],
    deadline: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "locked", "completed"],
      default: "pending",
    },
    submissions: [submissionSchema],
    aiSummary: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

asyncMeetingSchema.index({ creator: 1, createdAt: -1 });
asyncMeetingSchema.index({ status: 1, deadline: 1 });
asyncMeetingSchema.index({ participants: 1 });

const AsyncMeeting = mongoose.model("AsyncMeeting", asyncMeetingSchema);
export default AsyncMeeting;
