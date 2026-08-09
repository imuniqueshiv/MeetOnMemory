import mongoose from "mongoose";

const reportSectionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "ACTION_ITEMS",
        "ATTENDANCE_HEATMAP",
        "DECISION_LOG",
        "SENTIMENT_TIMELINE",
        "CUSTOM_TEXT",
      ],
    },
    title: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: true }, // Keep _id for subdocuments to help with UI drag/drop identification
);

const reportTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sections: {
      type: [reportSectionSchema],
      default: [],
    },
    defaultFilters: {
      dateRangeDays: {
        type: Number,
        default: 30,
      },
      tags: {
        type: [String],
        default: [],
      },
      meetingTypes: {
        type: [String],
        default: [],
      },
    },
    isShared: {
      type: Boolean,
      default: false,
    },
    generationCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
reportTemplateSchema.index({ organization: 1, createdBy: 1 });
reportTemplateSchema.index({ organization: 1, isShared: 1 });

const ReportTemplate = mongoose.model("ReportTemplate", reportTemplateSchema);

export default ReportTemplate;
