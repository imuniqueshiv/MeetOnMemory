import mongoose from "mongoose";

const savedFilterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    filters: {
      type: Object,
      default: {},
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isShared: {
      type: Boolean,
      default: false,
    },
    color: {
      type: String,
      default: "#3b82f6", // Default blue
    },
    icon: {
      type: String,
      default: "Filter",
    },
    matchCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Indexes for query performance
savedFilterSchema.index({ organization: 1, user: 1 });
savedFilterSchema.index({ organization: 1, isShared: 1 });

const SavedFilter = mongoose.model("SavedFilter", savedFilterSchema);
export default SavedFilter;
