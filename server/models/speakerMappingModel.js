import mongoose from "mongoose";

const speakerMappingSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    originalLabel: {
      type: String,
      required: true,
      trim: true,
    },
    mappedName: {
      type: String,
      required: true,
      trim: true,
    },
    isConfirmed: {
      type: Boolean,
      default: false,
    },
    voiceprintHints: {
      type: [String], // Future extensibility for voiceprint hints
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Indexes
speakerMappingSchema.index({ meeting: 1 });
speakerMappingSchema.index({ meeting: 1, originalLabel: 1 }, { unique: true });

const SpeakerMapping = mongoose.model("SpeakerMapping", speakerMappingSchema);
export default SpeakerMapping;
