import mongoose from "mongoose";

const meetingCostConfigSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    defaultHourlyRate: {
      type: Number,
      default: 50, // Default cost per hour per participant
    },
    currency: {
      type: String,
      default: "USD",
    },
    memberRateOverrides: {
      type: Map,
      of: Number, // key is user's email, value is their specific hourly rate
      default: {},
    },
    includePreparationTime: {
      type: Boolean,
      default: false,
    },
    prepTimeMultiplier: {
      type: Number,
      default: 1.0, // Multiplier for meeting duration to account for prep time (e.g., 1.5x)
    },
  },
  { timestamps: true },
);

const MeetingCostConfig = mongoose.model(
  "MeetingCostConfig",
  meetingCostConfigSchema,
);
export default MeetingCostConfig;
