import mongoose from "mongoose";

const meetingHealthSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      unique: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    compositeScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    factors: {
      agendaCoverage: { type: Number, default: 0, min: 0, max: 100 },
      timeAdherence: { type: Number, default: 0, min: 0, max: 100 },
      engagement: { type: Number, default: 0, min: 0, max: 100 },
      actionItemClarity: { type: Number, default: 0, min: 0, max: 100 },
      sentiment: { type: Number, default: 0, min: 0, max: 100 },
    },
    recommendations: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true },
);

// Indexes for querying by meeting and org trends
meetingHealthSchema.index({ organization: 1, createdAt: -1 });

export default mongoose.model("MeetingHealth", meetingHealthSchema);
