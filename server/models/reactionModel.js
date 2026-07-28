import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    emoji: {
      type: String,
      enum: ["👍", "❤️", "😂", "🎉", "🤔", "👏"],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: { expires: "30d" }, // Auto-delete after 30 days
    },
    transcriptSegmentIndex: {
      type: Number,
      required: false,
    },
  },
  { timestamps: true },
);

// Optimize aggregation queries
reactionSchema.index({ meeting: 1, emoji: 1 });

const Reaction = mongoose.model("Reaction", reactionSchema);
export default Reaction;
