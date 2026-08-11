import mongoose from "mongoose";

const digestPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      default: "weekly",
    },
    deliveryDay: {
      type: String, // e.g., "Monday" for weekly, or "1" for monthly
      default: "Monday",
    },
    deliveryHour: {
      type: Number, // 0-23
      default: 9, // 9 AM default
    },
    includeSections: {
      type: [String],
      default: ["action_items", "decisions", "summaries"],
    },
    filterByTags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],
    maxItems: {
      type: Number,
      default: 10,
    },
  },
  { timestamps: true },
);

export default mongoose.model("DigestPreference", digestPreferenceSchema);
