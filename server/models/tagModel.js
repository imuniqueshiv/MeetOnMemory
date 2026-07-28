import mongoose from "mongoose";

const tagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    color: {
      type: String,
      default: "#3B82F6", // Default blue
    },
    description: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Ensure tag names are unique per organization
tagSchema.index({ organization: 1, name: 1 }, { unique: true });

// For sorting tags by usage
tagSchema.index({ organization: 1, usageCount: -1 });

const Tag = mongoose.model("Tag", tagSchema);
export default Tag;
