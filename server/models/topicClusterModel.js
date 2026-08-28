import mongoose from "mongoose";

const topicClusterSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    canonicalTopicNames: [String],
    meetingCount: {
      type: Number,
      default: 0,
    },
    centroidEmbedding: {
      type: [Number], // Used to find similarity with new topics
      required: true,
    },
    isUserRenamed: {
      type: Boolean,
      default: false,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const TopicCluster = mongoose.model("TopicCluster", topicClusterSchema);
export default TopicCluster;
