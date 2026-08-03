import mongoose from "mongoose";

const threadReplySchema = new mongoose.Schema(
  {
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "followUpThread",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    ],
    edited: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const threadReplyModel =
  mongoose.models.threadReply ||
  mongoose.model("threadReply", threadReplySchema);

export default threadReplyModel;
