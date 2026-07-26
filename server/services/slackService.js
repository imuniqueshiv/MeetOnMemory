// server/services/slackService.js
import crypto from "crypto";
import axios from "axios";
import Organization from "../models/organizationModel.js";
import eventBus from "./eventBus.js";

// Slack Request Signature Verification

/**
 * Verifies that an incoming HTTP request genuinely originated from Slack.
 *
 * Slack signs every request it sends using HMAC-SHA256:
 *   basestring = "v0:{timestamp}:{rawBody}"
 *   signature  = "v0=" + hex(HMAC_SHA256(SLACK_SIGNING_SECRET, basestring))
 *
 * We re-compute the same HMAC and compare using timingSafeEqual to prevent
 * timing-attack vulnerabilities.
 *
 * @param {import('express').Request} req - Express request (must have req.rawBody set)
 * @returns {{ valid: boolean, reason?: string }}
 */
export const verifySlackSignature = (req) => {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return { valid: false, reason: "SLACK_SIGNING_SECRET is not configured" };
  }

  const slackSignature = req.headers["x-slack-signature"];
  const slackTimestamp = req.headers["x-slack-request-timestamp"];

  if (!slackSignature || !slackTimestamp) {
    return { valid: false, reason: "Missing Slack signature headers" };
  }

  // Reject requests older than 5 minutes to prevent replay attacks
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60;
  if (parseInt(slackTimestamp, 10) < fiveMinutesAgo) {
    return {
      valid: false,
      reason: "Request timestamp is too old (possible replay attack)",
    };
  }

  const rawBody = req.rawBody
    ? req.rawBody.toString("utf8")
    : JSON.stringify(req.body);

  const sigBasestring = `v0:${slackTimestamp}:${rawBody}`;
  const computedSignature =
    "v0=" +
    crypto
      .createHmac("sha256", signingSecret)
      .update(sigBasestring, "utf8")
      .digest("hex");

  // Timing-safe comparison to prevent timing attacks
  try {
    const a = Buffer.from(computedSignature, "utf8");
    const b = Buffer.from(slackSignature, "utf8");
    if (a.length !== b.length) {
      return { valid: false, reason: "Signature length mismatch" };
    }
    const isValid = crypto.timingSafeEqual(a, b);
    return {
      valid: isValid,
      reason: isValid ? undefined : "Signature mismatch",
    };
  } catch {
    return { valid: false, reason: "Signature comparison failed" };
  }
};

// Slack OAuth Token Exchange

/**
 * Exchanges a one-time OAuth code for a Slack Bot Token.
 * Called during the OAuth redirect callback.
 *
 * @param {string} code - The authorization code from Slack
 * @returns {Promise<object>} The Slack oauth.v2.access response data
 */
export const exchangeSlackCodeForToken = async (code) => {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    throw new Error("SLACK_CLIENT_ID or SLACK_CLIENT_SECRET is not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    ...(redirectUri && { redirect_uri: redirectUri }),
  });

  const response = await axios.post(
    "https://slack.com/api/oauth.v2.access",
    params.toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 10000,
    },
  );

  if (!response.data.ok) {
    throw new Error(`Slack OAuth exchange failed: ${response.data.error}`);
  }

  return response.data;
};

// Post Block Kit Message to Slack Channel

/**
 * Posts a Slack Block Kit message to a channel using the organization's bot token.
 *
 * @param {string} botToken - Slack bot OAuth token (xoxb-...)
 * @param {string} channelId - Target Slack channel ID (e.g. "C0123ABCDEF")
 * @param {Array}  blocks    - Array of Slack Block Kit block objects
 * @param {string} [fallbackText] - Plain-text fallback for notifications
 * @returns {Promise<object>} Slack API response
 */
export const postBlockMessage = async (
  botToken,
  channelId,
  blocks,
  fallbackText = "",
) => {
  const response = await axios.post(
    "https://slack.com/api/chat.postMessage",
    {
      channel: channelId,
      text: fallbackText,
      blocks,
    },
    {
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    },
  );

  if (!response.data.ok) {
    throw new Error(`Slack chat.postMessage failed: ${response.data.error}`);
  }

  return response.data;
};

// Block Kit Message Builders

/**
 * Builds a rich Slack Block Kit message to confirm a meeting was created
 * via the /mom-create slash command.
 *
 * @param {object} meeting   - Meeting document from MongoDB
 * @param {string} createdBy - Slack username who issued the command
 * @returns {Array} Block Kit blocks array
 */
export const buildMeetingCreatedBlocks = (meeting, createdBy) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const meetingUrl = `${frontendUrl}/meetings/${meeting._id}`;

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Meeting Created via MeetOnMemory",
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Title:*\n${meeting.title}` },
        { type: "mrkdwn", text: `*Created by:*\n${createdBy}` },
        {
          type: "mrkdwn",
          text: `*Date:*\n${meeting.date ? new Date(meeting.date).toDateString() : "TBD"}`,
        },
        {
          type: "mrkdwn",
          text: `*Type:*\n${meeting.meetingType || "General"}`,
        },
      ],
    },
    ...(meeting.description
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Description:*\n${meeting.description}`,
            },
          },
        ]
      : []),
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Meeting", emoji: true },
          url: meetingUrl,
          action_id: "view_meeting",
          style: "primary",
        },
      ],
    },
  ];
};

/**
 * Builds a rich Slack Block Kit message when Gemini finishes generating a MoM.
 * Formats the AI summary, key decisions, and action items into a scannable card.
 *
 * @param {object} meeting - Meeting document (with populated summary & structuredMoM)
 * @returns {Array} Block Kit blocks array
 */
export const buildMoMSummaryBlocks = (meeting) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const meetingUrl = `${frontendUrl}/meetings/${meeting._id}`;
  const mom = meeting.structuredMoM || {};

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "AI Meeting Summary Ready",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${meeting.title}*\n${meeting.summary ? meeting.summary.slice(0, 300) + (meeting.summary.length > 300 ? "…" : "") : "Summary generated."}`,
      },
    },
    { type: "divider" },
  ];

  // Key Decisions section
  const decisions = mom.decisions || mom.keyDecisions || [];
  if (decisions.length > 0) {
    const decisionList = decisions
      .slice(0, 5)
      .map(
        (d) =>
          `• ${typeof d === "string" ? d : d.description || d.decision || JSON.stringify(d)}`,
      )
      .join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*📌 Key Decisions:*\n${decisionList}` },
    });
  }

  // Action Items section
  const actionItems = mom.actionItems || mom.action_items || [];
  if (actionItems.length > 0) {
    const actionList = actionItems
      .slice(0, 5)
      .map((a) => {
        const task =
          typeof a === "string"
            ? a
            : a.task || a.description || JSON.stringify(a);
        const assignee = a.assignee ? ` _(${a.assignee})_` : "";
        return `• ${task}${assignee}`;
      })
      .join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Action Items:*\n${actionList}` },
    });
  }

  blocks.push(
    { type: "divider" },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Full Minutes", emoji: true },
          url: meetingUrl,
          action_id: "view_minutes",
          style: "primary",
        },
      ],
    },
  );

  return blocks;
};

// eventBus Listener: Post MoM to Slack on mom.generated

/**
 * Listens on the internal eventBus for 'mom.generated' events.
 * When fired, checks if the meeting's organization has Slack integration
 * configured. If yes, posts a formatted Block Kit summary to their channel.
 */
eventBus.on("mom.generated", async (meeting) => {
  const orgId = meeting?.organization;
  if (!orgId) return;

  try {
    // Explicitly select slackIntegration.botToken since it's select:false by default
    const org = await Organization.findById(orgId)
      .select(
        "+slackIntegration.botToken slackIntegration.channelId slackIntegration.teamId",
      )
      .lean();

    const slack = org?.slackIntegration;
    if (!slack?.botToken || !slack?.channelId) {
      // Slack not integrated for this org — silently skip
      return;
    }

    const blocks = buildMoMSummaryBlocks(meeting);
    await postBlockMessage(
      slack.botToken,
      slack.channelId,
      blocks,
      `AI Meeting Summary ready for "${meeting.title}"`,
    );

    console.log(
      `[Slack] MoM summary posted to channel ${slack.channelId} for org ${orgId}`,
    );
  } catch (err) {
    // Non-fatal: Slack posting failure should never crash the main AI pipeline
    console.error(
      `[Slack] Failed to post MoM summary to Slack for org ${orgId}:`,
      err.message,
    );
  }
});
