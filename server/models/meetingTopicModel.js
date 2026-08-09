import mongoose from "mongoose";

const meetingTopicSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    topics: [
      {
        name: { type: String, required: true },
        confidence: { type: Number, min: 0, max: 100 },
        timeRanges: [
          {
            start: { type: Number, required: true },
            end: { type: Number, required: true },
          },
        ],
        keywords: [String],
        embedding: { type: [Number], required: true }, // For cosine similarity
        clusterId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "TopicCluster",
          default: null,
        },
      },
    ],
  },
  { timestamps: true },
);

const MeetingTopic = mongoose.model("MeetingTopic", meetingTopicSchema);
export default MeetingTopic;
