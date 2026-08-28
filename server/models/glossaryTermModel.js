import mongoose from "mongoose";

const glossaryTermSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    term: {
      type: String,
      required: true,
      trim: true,
    },
    definition: {
      type: String,
      required: true,
      trim: true,
    },
    aliases: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      trim: true,
      default: "General",
    },
    examples: {
      type: [String],
      default: [],
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    isAutoSuggested: {
      type: Boolean,
      default: false,
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Full-text search index for term, definition, and aliases
glossaryTermSchema.index(
  {
    term: "text",
    definition: "text",
    aliases: "text",
  },
  {
    name: "glossary_text_index",
    weights: {
      term: 10,
      aliases: 5,
      definition: 1,
    },
  },
);

export default mongoose.model("GlossaryTerm", glossaryTermSchema);
