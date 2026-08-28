import mongoose from "mongoose";

const meetingNoteTemplateSchema = new mongoose.Schema(
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
    description: {
      type: String,
      default: "",
      trim: true,
    },
    sections: [
      {
        heading: { type: String, required: true },
        type: {
          type: String,
          enum: ["freeform", "checklist"],
          default: "freeform",
        },
        defaultContent: { type: String, default: "" },
      },
    ],
    visibility: {
      type: String,
      enum: ["private", "organization", "public"],
      default: "private",
    },
    useCount: {
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

meetingNoteTemplateSchema.index({ organizationId: 1, visibility: 1 });

const MeetingNoteTemplate = mongoose.model(
  "MeetingNoteTemplate",
  meetingNoteTemplateSchema,
);
export default MeetingNoteTemplate;
