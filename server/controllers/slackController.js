// server/controllers/slackController.js
/**
 * Slack Controller — HTTP layer only.
 *
 * Handles the three Slack-facing endpoints:
 *  GET  /api/slack/install          → Redirect user to Slack's OAuth consent page
 *  GET  /api/slack/oauth_redirect   → Exchange one-time code for bot token; save to org
 *  POST /api/slack/events           → Receive all Slack event/slash payloads
 *
 * Request signature verification (Slack Signing Secret) is applied as a
 * middleware for the /events endpoint. OAuth endpoints are safe because
 * they use the code parameter provided by Slack's own redirect.
 */

import Organization from "../models/organizationModel.js";
import User from "../models/userModel.js";
import jwt from "jsonwebtoken";
import { hasPermission } from "../utils/rbacPermissions.js";
import * as MeetingService from "../services/MeetingService.js";
import {
  verifySlackSignature,
  exchangeSlackCodeForToken,
  buildMeetingCreatedBlocks,
} from "../services/slackService.js";
import { sendError } from "../utils/responseHandler.js";

// Helpers

/**
 * Parse the text portion of a Slack slash command.
 
 * The convention we support:
 *   /mom-create "Meeting Title" @optionalTag
 
 * Returns { title, tags } where title is the quoted string (or the full
 * trimmed text when no quotes are used) and tags is an array of @-mentions.
 
 * @param {string} text - Raw command text from Slack payload
 * @returns {{ title: string, tags: string[] }}
 */
const parseSlashCommandText = (text = "") => {
  const trimmed = text.trim();

  // Match a quoted string at the start: "Q3 Planning" or 'Q3 Planning'
  const quotedMatch = trimmed.match(/^["'](.+?)["']/);
  const title = quotedMatch
    ? quotedMatch[1].trim()
    : trimmed.replace(/@\S+/g, "").trim();

  // Collect all @-mentions from the full text
  const tags = [...trimmed.matchAll(/@(\S+)/g)].map((m) => m[1]);

  return { title: title || "Untitled Meeting", tags };
};

// 1. GET /api/slack/install

/**
 * Redirects the authenticated user to Slack's OAuth consent page.
 * The `organizationId` is embedded in the OAuth `state` parameter so we can
 * associate the resulting bot token with the correct organization.
 
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const slackInstall = async (req, res, next) => {
  try {
    const clientId = process.env.SLACK_CLIENT_ID;
    if (!clientId) {
      return sendError(
        res,
        500,
        "Slack integration is not configured on this server.",
      );
    }

    // organizationId can come from an authenticated request (query or user object)
    let organizationId =
      req.query.organizationId || req.user?.organization?.toString() || "";

    if (
      typeof organizationId !== "string" ||
      !/^[0-9a-fA-F]{24}$/.test(organizationId)
    ) {
      return sendError(res, 400, "Invalid or missing organizationId format.");
    }

    // Generate JWT for state to protect against CSRF and verify authorization on callback
    const stateToken = jwt.sign(
      { orgId: organizationId, userId: req.user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    const redirectUri = process.env.SLACK_REDIRECT_URI;
    const scopes = "commands,chat:write,channels:read";

    const params = new URLSearchParams({
      client_id: clientId,
      scope: scopes,
      state: stateToken,
      ...(redirectUri && { redirect_uri: redirectUri }),
    });

    return res.redirect(
      `https://slack.com/oauth/v2/authorize?${params.toString()}`,
    );
  } catch (err) {
    return next(err);
  }
};

// 2. GET /api/slack/oauth_redirect

/**
 * Handles the redirect from Slack after the user approves the OAuth flow.
 * Exchanges the temporary `code` for a permanent bot token and saves the
 * Slack integration details to the matching Organization document.
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const slackOAuthRedirect = async (req, res, next) => {
  try {
    const { code, state: stateToken, error: slackError } = req.query;

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    if (!stateToken || typeof stateToken !== "string") {
      return sendError(res, 400, "Missing OAuth state.");
    }

    let decodedState;
    try {
      decodedState = jwt.verify(stateToken, process.env.JWT_SECRET);
    } catch (_err) {
      return sendError(res, 400, "Invalid or expired OAuth state.");
    }

    const organizationId = decodedState.orgId;
    const userId = decodedState.userId;

    // Handle user-denied or Slack error cases
    if (slackError) {
      const sanitizedError = encodeURIComponent(String(slackError));
      return res.redirect(
        `${frontendUrl}/organizations/${organizationId}?slackInstall=error&reason=${sanitizedError}`,
      );
    }

    if (!code || typeof code !== "string") {
      return sendError(res, 400, "Missing or invalid OAuth code from Slack.");
    }

    // Verify the user who initiated the install is still authorized for this org
    const user = await User.findById(userId);
    if (!user || user.organization?.toString() !== organizationId) {
      return sendError(res, 403, "Unauthorized organization binding.");
    }

    if (!hasPermission(user.role || "guest", "settings", "edit")) {
      return sendError(
        res,
        403,
        "Insufficient permissions to install integrations.",
      );
    }

    // Verify the organization exists before persisting anything
    const org = await Organization.findById(organizationId);
    if (!org) {
      return sendError(res, 404, "Organization not found.");
    }

    // Exchange the code for a bot token
    const slackData = await exchangeSlackCodeForToken(code);

    // Persist the integration details
    // slackData.access_token  = the bot token (xoxb-...)
    // slackData.incoming_webhook.channel_id = the channel the user selected
    // slackData.team.id / slackData.team.name = the Slack workspace info
    await Organization.findByIdAndUpdate(organizationId, {
      $set: {
        "slackIntegration.botToken": slackData.access_token,
        "slackIntegration.channelId":
          slackData.incoming_webhook?.channel_id || "",
        "slackIntegration.teamId": slackData.team?.id || "",
        "slackIntegration.teamName": slackData.team?.name || "",
        "slackIntegration.installedAt": new Date(),
      },
    });

    console.log(
      `✅ [Slack] Workspace "${slackData.team?.name}" connected to org ${organizationId}`,
    );

    // Redirect user back to the organization page in the frontend
    return res.redirect(
      `${frontendUrl}/organizations/${organizationId}?slackInstall=success`,
    );
  } catch (err) {
    return next(err);
  }
};

// 3. POST /api/slack/events

/**
 * Central handler for all incoming Slack payloads:
 *   - URL verification challenge (for initial Slack Event API setup)
 *   - Slash command: /mom-create
 *   - Slack Event Subscriptions (future extension point)
 * Signature verification is performed BEFORE reaching this handler via the
 * `slackSignatureMiddleware` applied in slackRoutes.js.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const handleSlackEvents = async (req, res, next) => {
  try {
    const body = req.body;

    // Case 1: Slack URL verification handshake
    // Slack sends this once when you first configure the Events API URL.
    if (body?.type === "url_verification") {
      return res.status(200).json({ challenge: body.challenge });
    }

    // Case 2: Slash command: /mom-create
    // Slack sends slash commands as application/x-www-form-urlencoded POST.
    // req.body will be parsed because express.urlencoded is active.
    if (body?.command === "/mom-create") {
      const text = typeof body.text === "string" ? body.text : "";
      const { title, tags } = parseSlashCommandText(text);
      const teamId = typeof body.team_id === "string" ? body.team_id : "";
      const userName =
        typeof body.user_name === "string" ? body.user_name : "someone";

      if (!teamId) {
        return res.status(200).json({
          response_type: "ephemeral",
          text: "❌ Could not identify your Slack workspace. Please re-install the bot.",
        });
      }

      // Find the organization linked to this Slack workspace
      // Using string coercion on teamId to prevent NoSQL query injection
      const org = await Organization.findOne({
        "slackIntegration.teamId": String(teamId),
      }).lean();

      if (!org) {
        return res.status(200).json({
          response_type: "ephemeral",
          text: `❌ Your Slack workspace is not connected to any MeetOnMemory organization.\nVisit your organization settings and click *Connect Slack* to get started.`,
        });
      }

      if (!title) {
        return res.status(200).json({
          response_type: "ephemeral",
          text: '❌ Please provide a meeting title. Usage: `/mom-create "Q3 Planning" @team`',
        });
      }

      // Create the meeting using the MeetingService
      // We pass null as userId (no authenticated user in slash commands);
      // the meeting is attributed to the organization's owner.
      const meeting = await MeetingService.createMeeting(
        org.owner.toString(), // userId — use org owner as the author
        org._id.toString(), // organizationId
        {
          title,
          description: tags.length
            ? `Created via Slack by @${userName}. Participants: ${tags.join(", ")}`
            : `Created via Slack by @${userName}`,
          meetingType: "conference",
          date: new Date().toISOString(),
          tags,
        },
        null, // io — socket not available in this context
      );

      // Respond immediately with a Block Kit message (Slack requires <3 s response)
      const blocks = buildMeetingCreatedBlocks(meeting, `@${userName}`);
      return res.status(200).json({
        response_type: "in_channel",
        text: `✅ Meeting "${title}" created by @${userName}`,
        blocks,
      });
    }

    // Case 3: Standard Slack Event Subscriptions
    // Acknowledge all other events with a 200 OK immediately (Slack requires this)
    // and process asynchronously if needed in the future.
    if (body?.type === "event_callback") {
      // Acknowledge first — Slack retries if no 200 within 3 seconds
      res.status(200).send();

      const event = body.event;
      console.log(
        `ℹ️ [Slack] Received event: ${event?.type} from team ${body.team_id}`,
      );
      // Future: handle app_mention, message events, etc.
      return;
    }

    // Default: acknowledge unknown payload types
    return res.status(200).send();
  } catch (err) {
    return next(err);
  }
};

// Middleware: Verify Slack Signing Secret

/**
 * Express middleware that verifies the Slack request signature.
 * Applied only to the /events POST endpoint.
 * Skipped in test environment (NODE_ENV === "test") to allow Jest to call freely.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const slackSignatureMiddleware = (req, res, next) => {
  // In test environments, skip signature verification to allow integration tests
  if (process.env.NODE_ENV === "test") {
    return next();
  }

  const { valid, reason } = verifySlackSignature(req);
  if (!valid) {
    console.warn(`⚠️ [Slack] Invalid signature rejected: ${reason}`);
    return res.status(401).json({ error: "Invalid Slack request signature." });
  }
  return next();
};
