import mongoose from "mongoose";

const meetingTemplateSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      default: "General",
      trim: true,
    },
    defaultDuration: {
      type: Number,
      default: 30, // in minutes
    },
    agendaBlocks: [
      {
        title: { type: String, required: true },
        description: { type: String, default: "" },
        duration: { type: Number, default: 15 }, // in minutes
      },
    ],
    defaultParticipants: [
      {
        type: String,
        trim: true,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

meetingTemplateSchema.index({ organizationId: 1, createdAt: -1 });

const MeetingTemplate = mongoose.model(
  "MeetingTemplate",
  meetingTemplateSchema,
);
export default MeetingTemplate;
