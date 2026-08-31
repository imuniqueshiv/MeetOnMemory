import mongoose from "mongoose";

const voiceQueryLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    queryText: {
      type: String,
      required: true,
    },
    responseText: {
      type: String,
    },
    status: {
      type: String,
      enum: ["success", "error"],
      default: "success",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

const VoiceQueryLog = mongoose.model("VoiceQueryLog", voiceQueryLogSchema);
export default VoiceQueryLog;
