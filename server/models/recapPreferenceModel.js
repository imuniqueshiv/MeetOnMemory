import mongoose from "mongoose";

const recapPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    deliveryTiming: {
      type: String,
      enum: ["immediate", "daily", "weekly"],
      default: "immediate",
    },
    includeTranscript: {
      type: Boolean,
      default: true,
    },
    includeActionItems: {
      type: Boolean,
      default: true,
    },
    includeSummary: {
      type: Boolean,
      default: true,
    },
    quietHoursStart: {
      type: Number,
      min: 0,
      max: 23,
    },
    quietHoursEnd: {
      type: Number,
      min: 0,
      max: 23,
    },
    timezone: {
      type: String,
      default: "UTC",
    },
  },
  { timestamps: true },
);

export default mongoose.model("RecapPreference", recapPreferenceSchema);
