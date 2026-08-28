import mongoose from "mongoose";

const participantContributionSchema = new mongoose.Schema(
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
      required: false,
    },
    participantId: {
      type: String,
      required: true,
    },
    participantName: {
      type: String,
      required: true,
    },
    dimensions: {
      verbal: { type: Number, default: 0, min: 0, max: 100 },
      decisional: { type: Number, default: 0, min: 0, max: 100 },
      task: { type: Number, default: 0, min: 0, max: 100 },
      collaborative: { type: Number, default: 0, min: 0, max: 100 },
    },
    overallImpact: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    coachingTips: {
      type: [String],
      default: [],
    },
    rawMetrics: {
      speakingDurationSec: { type: Number, default: 0 },
      utteranceCount: { type: Number, default: 0 },
      decisionsAuthored: { type: Number, default: 0 },
      actionItemsOwned: { type: Number, default: 0 },
      actionItemsCompleted: { type: Number, default: 0 },
      commentsAdded: { type: Number, default: 0 },
      reactionsGiven: { type: Number, default: 0 },
      agendaProposals: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  },
);

participantContributionSchema.index(
  { meetingId: 1, participantId: 1 },
  { unique: true },
);

const ParticipantContribution =
  mongoose.models.ParticipantContribution ||
  mongoose.model("ParticipantContribution", participantContributionSchema);

export default ParticipantContribution;
