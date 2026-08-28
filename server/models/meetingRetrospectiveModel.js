import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    wentWell: {
      type: String,
      default: "",
    },
    wentWellUpvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    couldImprove: {
      type: String,
      default: "",
    },
    couldImproveUpvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    actionSuggestions: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

const meetingRetrospectiveSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      unique: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },
    submissions: [submissionSchema],
    aiThemes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

// Indexes
meetingRetrospectiveSchema.index({ meetingId: 1 });
meetingRetrospectiveSchema.index({ organization: 1, createdAt: -1 });

export default mongoose.model(
  "MeetingRetrospective",
  meetingRetrospectiveSchema,
);
