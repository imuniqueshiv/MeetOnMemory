import mongoose from "mongoose";

const chapterSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  startTime: {
    type: Number,
    required: true,
  },
  endTime: {
    type: Number,
    required: true,
  },
  summary: {
    type: String,
    default: "",
  },
  keyQuotes: {
    type: [String],
    default: [],
  },
  sentiment: {
    type: String,
    enum: ["POSITIVE", "NEUTRAL", "NEGATIVE"],
    default: "NEUTRAL",
  },
  isManual: {
    type: Boolean,
    default: false,
  },
});

const transcriptChapterSchema = new mongoose.Schema(
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
    chapters: [chapterSchema],
  },
  { timestamps: true },
);

const TranscriptChapter = mongoose.model(
  "TranscriptChapter",
  transcriptChapterSchema,
);
export default TranscriptChapter;
