import mongoose from "mongoose";

const checklistItemSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, "Checklist item text is required"],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  required: {
    type: Boolean,
    default: false,
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  dueDate: {
    type: Date,
    default: null,
  },
});

const itemCompletionSchema = new mongoose.Schema({
  itemIndex: {
    type: Number,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  completedAt: {
    type: Date,
    default: Date.now,
  },
});

const meetingChecklistSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      unique: true,
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
    items: [checklistItemSchema],
    completions: [itemCompletionSchema],
  },
  {
    timestamps: true,
  },
);

meetingChecklistSchema.index({ meetingId: 1, "completions.userId": 1 });

const MeetingChecklist = mongoose.model(
  "MeetingChecklist",
  meetingChecklistSchema,
);

export default MeetingChecklist;
