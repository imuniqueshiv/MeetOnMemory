import mongoose from "mongoose";

const notionSyncRecordSchema = new mongoose.Schema(
  {
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    notionPageId: {
      type: String,
      required: true,
    },
    notionPageUrl: {
      type: String,
      default: null,
    },
    syncedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

const notionIntegrationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
      unique: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    accessToken: {
      type: String,
      required: true,
    },
    workspaceId: {
      type: String,
      required: true,
    },
    workspaceName: {
      type: String,
      default: "",
    },
    targetDatabaseId: {
      type: String,
      default: null,
    },
    syncHistory: {
      type: [notionSyncRecordSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const NotionIntegration =
  mongoose.models.NotionIntegration ||
  mongoose.model("NotionIntegration", notionIntegrationSchema);

export default NotionIntegration;
