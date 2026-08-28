import { Client, APIResponseError } from "@notionhq/client";
import { decryptToken } from "../utils/crypto.js";
import { transformMeetingToNotionBlocks } from "../utils/notionBlockTransformer.js";
import logger from "../utils/logger.js";

const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Sleep helper for retry/rate-limit backoff.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a Notion API call with bounded retries and rate-limit awareness.
 */
async function withRetry(fn, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err instanceof APIResponseError && err.status === 429;
      const isTransient =
        err instanceof APIResponseError &&
        err.status >= 500 &&
        err.status < 600;

      if (attempt >= retries || (!isRateLimit && !isTransient)) {
        throw err;
      }

      let delayMs;
      if (isRateLimit) {
        const retryAfter = err.headers?.get?.("retry-after");
        delayMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BASE_DELAY_MS * 2 ** attempt;
      } else {
        delayMs = BASE_DELAY_MS * 2 ** attempt;
      }

      logger.warn(
        `Notion API retry ${attempt + 1}/${retries} after ${delayMs}ms`,
        {
          status: err.status,
        },
      );
      await sleep(delayMs);
    }
  }
}

/**
 * Build an authenticated Notion Client, decrypting the stored token.
 */
function buildClient(encryptedToken) {
  const token = decryptToken(encryptedToken);
  return new Client({ auth: token });
}

/**
 * Exchange OAuth authorization code for a Notion access token.
 */
export const exchangeOAuthToken = async (code, redirectUri) => {
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Notion integration is not configured on the server.");
  }

  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(NOTION_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${encoded}`,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      data.error_description || "Failed to exchange Notion token",
    );
  }

  return data;
};

/**
 * List Notion databases the integration has access to.
 */
export const fetchDatabases = async (encryptedToken) => {
  const notion = buildClient(encryptedToken);

  const response = await withRetry(() =>
    notion.search({
      filter: { value: "database", property: "object" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
    }),
  );

  return response.results.map((db) => ({
    id: db.id,
    title: db.title?.[0]?.plain_text || "Untitled Database",
    url: db.url,
  }));
};

/**
 * Create a Notion page for a meeting. Uses the block transformer for content
 * and handles deduplication via sync history on the integration document.
 *
 * @param {Object} meeting - Meeting document
 * @param {Object} integration - NotionIntegration document (Mongoose)
 * @param {Array}  actionItems - ActionItem documents for this meeting
 * @returns {{ pageId: string, pageUrl: string, alreadySynced: boolean }}
 */
export const createMeetingPage = async (
  meeting,
  integration,
  actionItems = [],
  force = false,
) => {
  if (!integration.targetDatabaseId) {
    throw new Error("Target Notion database is not configured.");
  }

  if (!force) {
    const existingSync = integration.syncHistory?.find(
      (s) =>
        s.meetingId?.toString() === meeting._id?.toString() &&
        s.status === "success",
    );
    if (existingSync) {
      return {
        pageId: existingSync.notionPageId,
        pageUrl: existingSync.notionPageUrl,
        alreadySynced: true,
      };
    }
  }

  try {
    const notion = buildClient(integration.accessToken);
    const { properties, children } = transformMeetingToNotionBlocks(
      meeting,
      actionItems,
    );

    const response = await withRetry(() =>
      notion.pages.create({
        parent: { database_id: integration.targetDatabaseId },
        properties,
        children,
      }),
    );

    integration.syncHistory = integration.syncHistory || [];
    integration.syncHistory.push({
      meetingId: meeting._id,
      notionPageId: response.id,
      notionPageUrl: response.url || null,
      syncedAt: new Date(),
      status: "success",
    });
    await integration.save();

    logger.info(`Meeting ${meeting._id} synced to Notion page ${response.id}`);

    return {
      pageId: response.id,
      pageUrl: response.url,
      alreadySynced: false,
    };
  } catch (err) {
    integration.syncHistory = integration.syncHistory || [];
    integration.syncHistory.push({
      meetingId: meeting._id,
      notionPageId: "none",
      notionPageUrl: null,
      syncedAt: new Date(),
      status: "failed",
      errorMessage: err.message || "Failed to create Notion page",
    });
    await integration.save().catch((saveErr) => {
      logger.error("Failed to save failed Notion sync history:", saveErr);
    });
    throw err;
  }
};
