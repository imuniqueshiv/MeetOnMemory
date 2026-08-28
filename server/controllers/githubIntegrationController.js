import GithubIntegration from "../models/githubIntegrationModel.js";
import ActionItem from "../models/actionItemModel.js";
import { syncActionItemToGitHub } from "../services/githubSyncService.js";
import { encryptToken } from "../utils/crypto.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";
import { ValidationError } from "../utils/errors.js";
import axios from "axios";
import logger from "../utils/logger.js";
import crypto from "crypto";

const getOAuthStateSecret = () => {
  return (
    process.env.GITHUB_OAUTH_STATE_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    "github-oauth-state-secret-default"
  );
};

/**
 * Generate HMAC-SHA256 signed OAuth state parameter to prevent state tampering and CSRF attacks.
 *
 * @param {Object} payload - { organizationId, userId, repositoryFullName }
 * @returns {string} Signed state token formatted as `<base64urlData>.<hmacSignature>`
 */
export const generateSignedState = (payload) => {
  const secret = getOAuthStateSecret();
  const jsonStr = JSON.stringify({
    ...payload,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  });
  const base64Data = Buffer.from(jsonStr).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(base64Data)
    .digest("hex");

  return `${base64Data}.${signature}`;
};

/**
 * Verify HMAC-SHA256 signed OAuth state parameter using timing-safe comparison.
 *
 * @param {string} stateToken
 * @returns {Object|null} Decoded payload or null if invalid, tampered, or expired.
 */
export const verifySignedState = (stateToken) => {
  if (
    !stateToken ||
    typeof stateToken !== "string" ||
    !stateToken.includes(".")
  ) {
    return null;
  }

  const [base64Data, signature] = stateToken.split(".");
  const secret = getOAuthStateSecret();

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(base64Data)
    .digest("hex");

  const sigBuf = Buffer.from(signature.toLowerCase());
  const expBuf = Buffer.from(expectedSig.toLowerCase());

  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(base64Data, "base64url").toString("utf-8");
    const payload = JSON.parse(jsonStr);

    // Expire state tokens older than 15 minutes (900,000 ms)
    if (payload.timestamp && Date.now() - payload.timestamp > 15 * 60 * 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

export const initiateOAuth = async (req, res) => {
  try {
    const organizationId =
      req.query.organizationId || req.user?.organization?.toString();
    if (!organizationId) {
      return sendError(res, 400, "organizationId is required.");
    }

    // Ensure requesting user belongs to the targeted organization
    if (
      req.user?.organization &&
      req.user.organization.toString() !== organizationId.toString()
    ) {
      return sendError(res, 403, "Forbidden: Organization access mismatch.");
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return sendError(
        res,
        500,
        "GitHub OAuth is not configured on the server.",
      );
    }

    const state = generateSignedState({
      organizationId,
      userId: req.user?._id?.toString(),
    });

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo&state=${state}`;
    res.redirect(githubAuthUrl);
  } catch (error) {
    logger.error("GitHub Auth Error:", error);
    sendError(res, 500, "Failed to initiate GitHub OAuth.");
  }
};

export const handleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return sendError(res, 400, "Authorization code is missing.");
    }

    // Verify HMAC-SHA256 signature on state parameter
    const decodedState = verifySignedState(state);
    if (!decodedState || !decodedState.organizationId) {
      return sendError(res, 400, "Invalid or tampered state parameter.");
    }

    const { organizationId, repositoryFullName, userId } = decodedState;

    // Verify organization ownership if authenticated user is present
    if (
      req.user?.organization &&
      req.user.organization.toString() !== organizationId.toString()
    ) {
      return sendError(
        res,
        403,
        "Forbidden: State organization does not match user organization.",
      );
    }

    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } },
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      return sendError(res, 400, "Failed to obtain access token.");
    }

    await GithubIntegration.findOneAndUpdate(
      { organization: organizationId },
      {
        organization: organizationId,
        accessToken: encryptToken(accessToken),
        repositoryFullName: repositoryFullName || "",
        connectedBy: req.user?._id || userId || null,
      },
      { upsert: true, new: true },
    );

    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    res.redirect(
      `${clientUrl}/organization/settings?tab=integrations&github_success=true`,
    );
  } catch (error) {
    logger.error("GitHub Callback Error:", error);
    sendError(res, 500, "Failed to handle GitHub callback.");
  }
};

export const getStatus = async (req, res) => {
  try {
    const organizationId = req.params.organizationId;
    const integration = await GithubIntegration.findOne({
      organization: organizationId,
    });

    if (!integration) {
      return sendSuccess(res, { isConnected: false });
    }

    return sendSuccess(res, {
      isConnected: true,
      repositoryFullName: integration.repositoryFullName,
    });
  } catch (error) {
    logger.error("Get Status Error:", error);
    sendError(res, 500, "Failed to get GitHub integration status.");
  }
};

export const disconnect = async (req, res) => {
  try {
    const organizationId = req.params.organizationId;
    await GithubIntegration.findOneAndDelete({ organization: organizationId });
    return sendSuccess(res, {}, "Disconnected successfully.");
  } catch (error) {
    logger.error("Disconnect Error:", error);
    sendError(res, 500, "Failed to disconnect GitHub.");
  }
};

import WebhookDeliveryLog from "../models/webhookDeliveryLogModel.js";
import { decryptToken } from "../utils/crypto.js";

/**
 * Fetch recent webhook delivery logs for GitHub integration.
 */
export const getWebhookEvents = async (req, res) => {
  try {
    const events = await WebhookDeliveryLog.find({ provider: "github" })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return sendSuccess(res, { events }, "Webhook events retrieved.");
  } catch (error) {
    logger.error("Get Webhook Events Error:", error);
    sendError(res, 500, "Failed to get webhook events.");
  }
};

/**
 * Fetch available GitHub repositories for the linked organization.
 */
export const getRepositories = async (req, res) => {
  try {
    const organizationId = req.params.organizationId;
    const integration = await GithubIntegration.findOne({
      organization: organizationId,
    });

    if (!integration || !integration.accessToken) {
      return sendSuccess(res, { repositories: [] });
    }

    try {
      const token = decryptToken(integration.accessToken);
      const ghRes = await axios.get("https://api.github.com/user/repos", {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
        params: { sort: "updated", per_page: 50 },
        timeout: 5000,
      });

      const repositories = (ghRes.data || []).map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        description: r.description,
        url: r.html_url,
      }));

      return sendSuccess(res, { repositories });
    } catch (_ghErr) {
      // Fallback if token is expired or sandbox mode
      return sendSuccess(res, {
        repositories: integration.repositoryFullName
          ? [
              {
                id: 1,
                name:
                  integration.repositoryFullName.split("/")[1] ||
                  integration.repositoryFullName,
                fullName: integration.repositoryFullName,
                url: `https://github.com/${integration.repositoryFullName}`,
              },
            ]
          : [],
      });
    }
  } catch (error) {
    logger.error("Get Repositories Error:", error);
    sendError(res, 500, "Failed to fetch repositories.");
  }
};

/**
 * Update the linked repository for an organization (Issue #1600).
 */
export const updateRepository = async (req, res) => {
  try {
    const organizationId = req.params.organizationId;
    const { repositoryFullName } = req.body;

    if (
      !repositoryFullName ||
      typeof repositoryFullName !== "string" ||
      !repositoryFullName.includes("/")
    ) {
      throw new ValidationError(
        "repositoryFullName is required and must be in 'owner/repo' format.",
      );
    }

    const integration = await GithubIntegration.findOne({
      organization: organizationId,
    });
    if (!integration) {
      return sendError(
        res,
        404,
        "GitHub integration not found for this organization.",
      );
    }

    integration.repositoryFullName = repositoryFullName.trim();
    await integration.save();

    return sendSuccess(
      res,
      {
        repositoryFullName: integration.repositoryFullName,
      },
      "Repository updated.",
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendError(res, 400, error.message);
    }
    logger.error("Update Repository Error:", error);
    sendError(res, 500, "Failed to update repository.");
  }
};

/**
 * Manually trigger sync of a specific action item to GitHub (Issue #1600).
 */
export const syncActionItem = async (req, res) => {
  try {
    const { actionItemId } = req.body;
    if (!actionItemId) {
      throw new ValidationError("actionItemId is required.");
    }

    const userOrgId = req.user?.organization?.toString();
    const actionItem = await ActionItem.findById(actionItemId);
    if (!actionItem) {
      return sendError(res, 404, "Action item not found.");
    }

    const itemOrgId = actionItem.organization?.toString();
    if (itemOrgId && userOrgId && itemOrgId !== userOrgId) {
      return sendError(res, 403, "You do not have access to this action item.");
    }

    const result = await syncActionItemToGitHub(actionItem);
    if (!result) {
      return sendError(
        res,
        400,
        "No GitHub integration configured for this organization.",
      );
    }

    return sendSuccess(
      res,
      {
        githubIssueNumber: result.number,
        githubIssueUrl: result.html_url,
        alreadySynced: result.alreadySynced || false,
      },
      result.alreadySynced
        ? "Action item was already synced."
        : "Action item synced to GitHub.",
      result.alreadySynced ? 200 : 201,
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendError(res, 400, error.message);
    }
    logger.error("Sync Action Item Error:", error);
    sendError(res, 500, "Failed to sync action item to GitHub.");
  }
};
