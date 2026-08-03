import mongoose from "mongoose";

const noteVersionSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    field: {
      type: String,
      enum: ["collaborativeNotes", "summary"],
      required: true,
    },
    version: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      default: "",
    },
    contentHash: {
      type: String,
      required: true,
    },
    changeSource: {
      type: String,
      enum: ["user_edit", "ai_processing", "system"],
      default: "user_edit",
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    bytesDiff: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Indexes
noteVersionSchema.index({ meetingId: 1, field: 1, version: -1 });

const NoteVersion = mongoose.model("NoteVersion", noteVersionSchema);
export default NoteVersion;
