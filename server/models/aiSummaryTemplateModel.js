import mongoose from "mongoose";

const aiSummaryTemplateSchema = new mongoose.Schema(
  {
    organization: {
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
    },
    customInstructions: {
      type: String,
      maxLength: 2000,
      default: "",
    },
    expectedFormat: {
      type: String,
      enum: ["markdown", "json", "text"],
      default: "json",
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Indexes to speed up lookups by org and isDefault checks
aiSummaryTemplateSchema.index({ organization: 1, name: 1 });
aiSummaryTemplateSchema.index({ organization: 1, isDefault: 1 });

const AiSummaryTemplate = mongoose.model(
  "AiSummaryTemplate",
  aiSummaryTemplateSchema,
);

export default AiSummaryTemplate;
