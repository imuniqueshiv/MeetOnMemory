import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false },
);

export const MAX_COMMENT_LENGTH = 2000;

const commentSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: [
        MAX_COMMENT_LENGTH,
        `Comment content exceeds maximum length of ${MAX_COMMENT_LENGTH} characters`,
      ],
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    reactions: [reactionSchema],
  },
  { timestamps: true },
);

// Indexes for quick lookups
commentSchema.index({ meeting: 1, createdAt: 1 });
commentSchema.index({ parentComment: 1 });

const Comment = mongoose.model("Comment", commentSchema);
export default Comment;
