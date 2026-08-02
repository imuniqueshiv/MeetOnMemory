import mongoose from "mongoose";

const annotationSchema = new mongoose.Schema({
  annotationText: {
    type: String,
    required: true,
  },
  sourceField: {
    type: String,
    enum: ["transcript", "summary"],
    default: "transcript",
  },
  offsets: {
    start: {
      type: Number,
      required: true,
    },
    end: {
      type: Number,
      required: true,
    },
  },
  color: {
    type: String,
    default: "#ffeb3b",
  },
});

const personalNoteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    content: {
      type: String,
      default: "",
    },
    annotations: [annotationSchema],
    isPinned: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Ensure a user can only have one personal note document per meeting
personalNoteSchema.index({ userId: 1, meetingId: 1 }, { unique: true });

// Text index for search functionality
personalNoteSchema.index(
  { content: "text", "annotations.annotationText": "text" },
  {
    name: "personal_note_text_index",
    weights: { content: 2, "annotations.annotationText": 1 },
  },
);

const PersonalNote = mongoose.model("PersonalNote", personalNoteSchema);

export default PersonalNote;
