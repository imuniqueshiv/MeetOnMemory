import axios from "axios";
import CryptoJS from "crypto-js";
import NotionIntegrationConfig from "../models/NotionIntegrationConfig.js";
import { syncToNotionDatabase } from "../services/notionSyncService.js";
import { transformMoMToNotionBlocks, createNotionProperties } from "../services/notionBlockTransformer.js";

const encryptToken = (token) => {
  return CryptoJS.AES.encrypt(
    token,
    process.env.NOTION_ENCRYPTION_SECRET || "default_secret"
  ).toString();
};

export const getNotionAuthUrl = (req, res) => {
  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(500).json({ success: false, message: "Notion credentials not configured" });
  }

  const url = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.json({ success: true, url });
};

export const handleNotionCallback = async (req, res) => {
  try {
    const { code, orgId } = req.body;
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = process.env.NOTION_REDIRECT_URI;

    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await axios.post(
      "https://api.notion.com/v1/oauth/token",
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      },
      {
        headers: {
          Authorization: `Basic ${authString}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { access_token, workspace_id, workspace_name, bot_id } = response.data;
    const encryptedToken = encryptToken(access_token);

    await NotionIntegrationConfig.findOneAndUpdate(
      { organizationId: orgId },
      {
        encryptedAccessToken: encryptedToken,
        workspaceId: workspace_id,
        workspaceName: workspace_name,
        botId: bot_id,
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: "Notion connected successfully." });
  } catch (error) {
    console.error("Notion callback error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Failed to connect to Notion." });
  }
};

export const updateTargetDatabase = async (req, res) => {
  try {
    const { databaseId } = req.body;
    const config = req.notionConfig; // from notionAuthGuard

    config.targetDatabaseId = databaseId;
    await config.save();

    res.json({ success: true, message: "Target database updated successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

export const syncMeetingToNotion = async (req, res) => {
  try {
    const config = req.notionConfig;
    const { meetingTitle, summary, actionItems } = req.body;

    const properties = createNotionProperties(meetingTitle);
    const blocks = transformMoMToNotionBlocks(meetingTitle, summary, actionItems);

    const result = await syncToNotionDatabase(config, blocks, properties);

    res.json({ success: true, message: "Meeting synced to Notion successfully.", result });
  } catch (error) {
    console.error("Notion sync error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to sync to Notion." });
  }
};
