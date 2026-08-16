import mongoose from "mongoose";

const notionIntegrationConfigSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    encryptedAccessToken: {
      type: String,
      required: true,
    },
    workspaceId: {
      type: String,
      required: true,
    },
    workspaceName: {
      type: String,
    },
    botId: {
      type: String,
    },
    targetDatabaseId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const NotionIntegrationConfig =
  mongoose.models.NotionIntegrationConfig ||
  mongoose.model("NotionIntegrationConfig", notionIntegrationConfigSchema);

export default NotionIntegrationConfig;
