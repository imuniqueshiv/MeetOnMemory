import mongoose from "mongoose";

const topicIntelligenceSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    clusterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TopicCluster",
      required: true,
      index: true,
    },
    weekStarting: {
      type: Date,
      required: true,
      index: true,
    },
    occurrences: {
      type: Number,
      default: 0,
    },
    trendDirection: {
      type: String,
      enum: ["rising", "declining", "stable"],
      default: "stable",
    },
    relatedTopics: [
      {
        clusterId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "TopicCluster",
        },
        weight: Number, // Optional weight/count of co-occurrences
      },
    ],
    isOrphaned: {
      type: Boolean,
      default: false,
    },
    sentimentScore: {
      type: Number, // E.g., -1.0 to 1.0 or 0 to 100
      default: null,
    },
  },
  { timestamps: true },
);

// Compound index for quick lookup of a specific topic's intelligence for a given week
topicIntelligenceSchema.index({
  organization: 1,
  clusterId: 1,
  weekStarting: -1,
});

const TopicIntelligence = mongoose.model(
  "TopicIntelligence",
  topicIntelligenceSchema,
);
export default TopicIntelligence;
