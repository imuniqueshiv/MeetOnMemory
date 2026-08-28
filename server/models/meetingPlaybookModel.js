import mongoose from "mongoose";

const playbookStepSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  durationMinutes: {
    type: Number,
    required: true,
    min: 1,
  },
  facilitatorPrompts: {
    type: [String],
    default: [],
  },
  expectedOutputs: {
    type: [String],
    default: [],
  },
});

const meetingPlaybookSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    steps: {
      type: [playbookStepSchema],
      default: [],
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    averageEffectivenessScore: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

const MeetingPlaybook = mongoose.model(
  "MeetingPlaybook",
  meetingPlaybookSchema,
);
export default MeetingPlaybook;
