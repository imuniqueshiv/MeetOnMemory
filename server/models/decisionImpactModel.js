import mongoose from "mongoose";

const decisionImpactSchema = new mongoose.Schema(
  {
    decisionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Decision",
      required: true,
      unique: true,
    },
    outcomeStatus: {
      type: String,
      enum: ["success", "failure", "mixed", "pending"],
      default: "pending",
    },
    impactScore: {
      type: Number,
      min: 1,
      max: 100,
      default: null,
    },
    evidence: {
      type: [String],
      default: [],
    },
    nextReviewDate: {
      type: Date,
      default: null,
    },
    owner: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

const DecisionImpact =
  mongoose.models.DecisionImpact ||
  mongoose.model("DecisionImpact", decisionImpactSchema);

export default DecisionImpact;
