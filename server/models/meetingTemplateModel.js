import mongoose from "mongoose";

const meetingTemplateSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    agendaBlocks: [
      {
        title: { type: String, required: true },
        description: { type: String, default: "" },
        duration: { type: Number, default: null }, // in minutes
      },
    ],
  },
  { timestamps: true },
);

meetingTemplateSchema.index({ organizationId: 1, createdAt: -1 });

const MeetingTemplate = mongoose.model(
  "MeetingTemplate",
  meetingTemplateSchema,
);
export default MeetingTemplate;
