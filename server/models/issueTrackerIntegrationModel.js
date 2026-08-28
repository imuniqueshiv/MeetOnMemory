import mongoose from "mongoose";

const issueTrackerIntegrationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    provider: {
      type: String,
      enum: ["jira", "linear"],
      required: true,
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      default: null,
    },
    webhookSecret: {
      type: String,
      default: null, // used to verify incoming webhooks
    },
    config: {
      // provider-specific config like siteUrl, projectKey, teamId, fieldMappings, statusMappings
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    connectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
    lastSyncStatus: {
      type: String,
      enum: ["success", "error", "idle"],
      default: "idle",
    },
    lastSyncError: {
      type: String,
      default: null,
    },
    syncCount: {
      type: Number,
      default: 0,
    },
    syncLogs: [
      {
        timestamp: { type: Date, default: Date.now },
        action: { type: String, required: true },
        status: { type: String, required: true },
        details: { type: String, default: "" },
        error: { type: String, default: null },
      },
    ],
  },

  { timestamps: true },
);

// Allow one integration per provider per organization
issueTrackerIntegrationSchema.index(
  { organization: 1, provider: 1 },
  { unique: true },
);

const IssueTrackerIntegration =
  mongoose.models.IssueTrackerIntegration ||
  mongoose.model("IssueTrackerIntegration", issueTrackerIntegrationSchema);

export default IssueTrackerIntegration;
