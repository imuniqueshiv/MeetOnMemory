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
    /**
     * Set when this template was cloned out of the shared library
     * (Issue #1275).
     *
     * `cloneTemplate` already tried to record provenance, as
     * `metadata: { clonedFromLibrary: true, clonedFromId: … }` — but this
     * schema has never declared a `metadata` path, so Mongoose's default strict
     * mode dropped the whole object on save without complaint. Every clone
     * created since the feature shipped has no record of where it came from.
     *
     * A declared, typed ref instead of a Mixed bag: the intent was always a
     * pointer to one library entry.
     */
    clonedFromLibraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TemplateLibrary",
      default: null,
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
