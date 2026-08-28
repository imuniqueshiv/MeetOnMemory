import mongoose from "mongoose";

const icebreakerSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["fun", "deep", "work-related"],
      default: "fun",
    },
    promptText: {
      type: String,
      required: true,
    },
    usedInMeetings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Meeting",
      },
    ],
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const Icebreaker = mongoose.model("Icebreaker", icebreakerSchema);
export default Icebreaker;
