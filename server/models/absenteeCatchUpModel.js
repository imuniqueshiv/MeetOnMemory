import mongoose from "mongoose";

const absenteeCatchUpSchema = new mongoose.Schema(
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
      index: true,
    },
    content: {
      type: mongoose.Schema.Types.Mixed, // Storing structured AI output (summary, actionItems, mentions)
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "read", "delivered"],
      default: "pending",
    },
    sentAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Ensure a user only has one catch-up per meeting
absenteeCatchUpSchema.index({ meetingId: 1, userId: 1 }, { unique: true });

const AbsenteeCatchUp = mongoose.model(
  "AbsenteeCatchUp",
  absenteeCatchUpSchema,
);

export default AbsenteeCatchUp;
