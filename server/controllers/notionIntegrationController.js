/**
 * Notion Integration Controller (Issue #1602).
 *
 * Handles OAuth flow, database configuration, manual sync, status, and disconnect.
 * Uses HMAC-signed state for CSRF protection and encrypts tokens at rest.
 */

import crypto from "crypto";
import NotionIntegration from "../models/notionIntegrationModel.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import Organization from "../models/organizationModel.js";
import { encryptToken } from "../utils/crypto.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";
import * as notionSync from "../services/notionSyncService.js";
import logger from "../utils/logger.js";

// ── OAuth state helpers ─────────────────────────────────────────────────

const getSecretKey = () =>
  process.env.NOTION_OAUTH_SECRET ||
  process.env.JWT_SECRET ||
  "fallback-notion-oauth-secret-key";

export const sanitizeIntegration = (integration) => {
  if (!integration) return null;
  const obj =
    typeof integration.toObject === "function"
      ? integration.toObject()
      : { ...integration };
  delete obj.accessToken;
  delete obj.token;
  delete obj.access_token;
  delete obj.botToken;
  return obj;
};

export const generateSignedState = (
  organizationId,
  secret = getSecretKey(),
) => {
  if (!organizationId) {
    throw new Error("organizationId is required to generate OAuth state");
  }
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = Buffer.from(
    JSON.stringify({ organizationId, timestamp, nonce }),
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return `${payload}.${signature}`;
};

export const verifySignedState = (state, secret = getSecretKey()) => {
  if (!state || typeof state !== "string" || !state.includes(".")) {
    return { valid: false, error: "Invalid state format" };
  }

  const parts = state.split(".");
  if (parts.length !== 2)
    return { valid: false, error: "Malformed state parameter" };

  const [payload, signature] = parts;
  if (!payload || !signature) {
    return { valid: false, error: "Missing state payload or signature" };
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return {
      valid: false,
      error: "Invalid OAuth state signature (tampered state detected)",
    };
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8"),
    );
    if (!decoded.organizationId) {
      return { valid: false, error: "Missing organizationId in state payload" };
    }
    const MAX_AGE_MS = 15 * 60 * 1000;
    if (decoded.timestamp && Date.now() - decoded.timestamp > MAX_AGE_MS) {
      return { valid: false, error: "OAuth state has expired" };
    }
    return { valid: true, organizationId: decoded.organizationId };
  } catch {
    return { valid: false, error: "Failed to parse state payload" };
  }
};

// ── Route handlers ──────────────────────────────────────────────────────

export const initiateOAuth = async (req, res) => {
  try {
    const organizationId = req.user?.organization?.toString();
    if (!organizationId || !/^[0-9a-fA-F]{24}$/.test(organizationId)) {
      return sendError(res, 400, "Invalid or missing organization.");
    }

    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.NOTION_REDIRECT_URI;
    const state = generateSignedState(organizationId);

    if (!clientId) {
      return sendSuccess(res, { state }, "Notion OAuth state generated.");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      owner: "user",
      state,
      ...(redirectUri && { redirect_uri: redirectUri }),
    });

    const authUrl = `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;

    if (
      req.query.redirect === "false" ||
      req.headers["accept"]?.includes("application/json")
    ) {
      return sendSuccess(res, { authUrl, state });
    }

    return res.redirect(authUrl);
  } catch (error) {
    logger.error("Notion OAuth initiate error:", error);
    sendError(res, 500, "Failed to initiate Notion OAuth.");
  }
};

export const oauthCallback = async (req, res) => {
  try {
    const { code, state, error: notionError } = req.query;

    if (notionError) {
      return sendError(res, 400, `Notion OAuth error: ${notionError}`);
    }
    if (!state) return sendError(res, 400, "Missing OAuth state parameter.");
    if (!code) return sendError(res, 400, "Missing OAuth code.");

    const verification = verifySignedState(state);
    if (!verification.valid) {
      return sendError(res, 400, verification.error || "Invalid OAuth state.");
    }

    const organizationId = verification.organizationId;
    const org = await Organization.findById(organizationId);
    if (!org) return sendError(res, 404, "Organization not found.");

    const redirectUri = process.env.NOTION_REDIRECT_URI;
    const tokenData = await notionSync.exchangeOAuthToken(code, redirectUri);

    const accessToken = tokenData.access_token;
    if (!accessToken)
      return sendError(res, 400, "Failed to obtain Notion access token.");

    await NotionIntegration.findOneAndUpdate(
      { organization: organizationId },
      {
        organization: organizationId,
        accessToken: encryptToken(accessToken),
        workspaceId: tokenData.workspace_id || "",
        workspaceName: tokenData.workspace_name || "",
        createdBy: req.user?._id || null,
      },
      { upsert: true, new: true },
    );

    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    return res.redirect(
      `${clientUrl}/organization/settings?tab=integrations&notion_success=true`,
    );
  } catch (error) {
    logger.error("Notion OAuth callback error:", error);
    sendError(res, 500, "Failed to complete Notion OAuth.");
  }
};

export const getStatus = async (req, res) => {
  try {
    const orgId = req.user?.organization?.toString();
    const integration = await NotionIntegration.findOne({
      organization: orgId,
    });
    if (!integration) {
      return sendSuccess(res, { isConnected: false });
    }
    return sendSuccess(res, {
      isConnected: true,
      workspaceName: integration.workspaceName,
      targetDatabaseId: integration.targetDatabaseId,
    });
  } catch (error) {
    logger.error("Notion getStatus error:", error);
    sendError(res, 500, "Failed to get Notion integration status.");
  }
};

export const getDatabases = async (req, res) => {
  try {
    const orgId = req.user?.organization?.toString();
    const integration = await NotionIntegration.findOne({
      organization: orgId,
    });
    if (!integration)
      return sendError(res, 404, "Notion integration not found.");

    const databases = await notionSync.fetchDatabases(integration.accessToken);
    return sendSuccess(res, { databases });
  } catch (error) {
    logger.error("Notion getDatabases error:", error);
    sendError(res, 500, "Failed to fetch Notion databases.");
  }
};

export const saveMapping = async (req, res) => {
  try {
    const orgId = req.user?.organization?.toString();
    const { databaseId } = req.body;

    if (!databaseId || typeof databaseId !== "string") {
      return sendError(res, 400, "databaseId is required.");
    }

    const integration = await NotionIntegration.findOne({
      organization: orgId,
    });
    if (!integration)
      return sendError(res, 404, "Notion integration not found.");

    integration.targetDatabaseId = databaseId;
    await integration.save();

    return sendSuccess(
      res,
      { integration: sanitizeIntegration(integration) },
      "Database mapping saved.",
    );
  } catch (error) {
    logger.error("Notion saveMapping error:", error);
    sendError(res, 500, "Failed to save Notion mapping.");
  }
};

export const disconnect = async (req, res) => {
  try {
    const orgId = req.user?.organization?.toString();
    await NotionIntegration.findOneAndDelete({ organization: orgId });
    return sendSuccess(res, {}, "Notion integration disconnected.");
  } catch (error) {
    logger.error("Notion disconnect error:", error);
    sendError(res, 500, "Failed to disconnect Notion.");
  }
};

export const syncMeeting = async (req, res) => {
  try {
    const orgId = req.user?.organization?.toString();
    const { meetingId, force } = req.body;

    if (!meetingId) return sendError(res, 400, "meetingId is required.");

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) return sendError(res, 404, "Meeting not found.");
    if (meeting.organization?.toString() !== orgId) {
      return sendError(res, 403, "Access denied.");
    }

    const integration = await NotionIntegration.findOne({
      organization: orgId,
    });
    if (!integration)
      return sendError(res, 404, "Notion integration not found.");
    if (!integration.targetDatabaseId) {
      return sendError(res, 400, "Target Notion database is not configured.");
    }

    const actionItems = await ActionItem.find({
      sourceMeetingId: meetingId,
      organization: orgId,
    });

    const result = await notionSync.createMeetingPage(
      meeting,
      integration,
      actionItems,
      Boolean(force),
    );

    return sendSuccess(
      res,
      {
        notionPageId: result.pageId,
        notionPageUrl: result.pageUrl,
        alreadySynced: result.alreadySynced || false,
      },
      result.alreadySynced
        ? "Meeting was already synced."
        : "Meeting synced to Notion.",
      result.alreadySynced ? 200 : 201,
    );
  } catch (error) {
    logger.error("Notion syncMeeting error:", error);
    sendError(res, 500, error.message || "Failed to sync meeting to Notion.");
  }
};

export const getSyncHistory = async (req, res) => {
  try {
    const orgId = req.user?.organization?.toString();
    const integration = await NotionIntegration.findOne({
      organization: orgId,
    }).populate({
      path: "syncHistory.meetingId",
      select: "title date meetingType status",
    });

    if (!integration) {
      return sendSuccess(res, { history: [], total: 0 });
    }

    const { status, limit = 50, page = 1 } = req.query;
    let history = [...(integration.syncHistory || [])];

    if (status && status !== "all") {
      history = history.filter((item) => item.status === status);
    }

    history.sort(
      (a, b) =>
        new Date(b.syncedAt || b.createdAt || 0) -
        new Date(a.syncedAt || a.createdAt || 0),
    );

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = history.slice(startIndex, startIndex + limitNum);

    const formatted = paginated.map((item) => {
      const meeting = item.meetingId;
      const isPopulated =
        meeting && typeof meeting === "object" && meeting.title;

      return {
        _id: item._id || item.notionPageId,
        meetingId: isPopulated ? meeting._id : item.meetingId,
        meetingTitle: isPopulated ? meeting.title : "Meeting Record",
        meetingDate: isPopulated ? meeting.date : null,
        meetingType: isPopulated ? meeting.meetingType : "conference",
        notionPageId: item.notionPageId,
        notionPageUrl: item.notionPageUrl,
        status: item.status,
        errorMessage: item.errorMessage,
        syncedAt: item.syncedAt || item.createdAt,
      };
    });

    return sendSuccess(res, {
      history: formatted,
      total: history.length,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    logger.error("Notion getSyncHistory error:", error);
    sendError(res, 500, "Failed to fetch Notion sync history.");
  }
};
