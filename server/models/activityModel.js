import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      // Examples: "meeting.created", "policy.updated", "membership.joined"
    },
    targetType: {
      type: String,
      required: true,
      // Examples: "Meeting", "Policy", "User"
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    targetTitle: {
      type: String,
      // The title or name of the target entity at the time of the action (for display without extra lookups)
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Any additional data (e.g., summary preview, changes, etc.)
    },
  },
  {
    timestamps: true,
  },
);

// Index for getting a chronological feed for an organization quickly
activitySchema.index({ organization: 1, createdAt: -1 });

export default mongoose.model("Activity", activitySchema);
