import mongoose from "mongoose";

const followUpThreadSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "meeting",
      required: true,
      index: true,
    },
    anchorType: {
      type: String,
      enum: ["decision", "action_item", "agenda_item", "general"],
      default: "general",
      required: true,
    },
    anchorIndex: {
      type: String,
    },
    anchorText: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
  },
  { timestamps: true },
);

const followUpThreadModel =
  mongoose.models.followUpThread ||
  mongoose.model("followUpThread", followUpThreadSchema);

export default followUpThreadModel;
