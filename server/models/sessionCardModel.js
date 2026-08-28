import mongoose from "mongoose";

const sessionCardSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    eventName: {
      type: String,
      trim: true,
      default: "",
    },
    sessionTitle: {
      type: String,
      required: true,
      trim: true,
    },
    speaker: {
      type: String,
      trim: true,
      default: "",
    },
    speakerTitle: {
      type: String,
      trim: true,
      default: "",
    },
    speakerBio: {
      type: String,
      trim: true,
      default: "",
    },
    summary: {
      type: String,
      default: "",
    },
    keywords: {
      type: [String],
      default: [],
    },
    videoUrl: {
      type: String,
      default: null,
    },
    slideUrls: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

sessionCardSchema.index({ organization: 1, createdAt: -1 });
sessionCardSchema.index({
  sessionTitle: "text",
  eventName: "text",
  speaker: "text",
  summary: "text",
  keywords: "text",
});

const SessionCard =
  mongoose.models.SessionCard ||
  mongoose.model("SessionCard", sessionCardSchema);

export default SessionCard;
