import mongoose from "mongoose";

const citationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["transcript", "decision", "action_item"],
    required: true,
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  excerpt: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Number, // Applicable mainly to transcripts (start time in seconds)
    default: null,
  },
  marker: {
    type: String, // e.g., "[1]"
    required: true,
  },
});

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  citations: [citationSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const debriefSessionSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Meeting",
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  messages: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

debriefSessionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const DebriefSession = mongoose.model("DebriefSession", debriefSessionSchema);

export default DebriefSession;
