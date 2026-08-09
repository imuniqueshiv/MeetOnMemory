import mongoose from "mongoose";

const pollOptionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  votes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});

const pollSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [pollOptionSchema],
      validate: [
        (v) => v.length >= 2,
        "A poll must have at least two options.",
      ],
    },
    pollType: {
      type: String,
      enum: ["single", "multiple"],
      default: "single",
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    isClosed: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Indexes
pollSchema.index({ meeting: 1, createdAt: -1 });
pollSchema.index({ isClosed: 1, expiresAt: 1 });

const Poll = mongoose.model("Poll", pollSchema);
export default Poll;
