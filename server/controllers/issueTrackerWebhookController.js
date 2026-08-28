import ActionItem from "../models/actionItemModel.js";
import IssueTrackerIntegration from "../models/issueTrackerIntegrationModel.js";
import crypto from "crypto";

const recordSyncLog = async (
  orgId,
  provider,
  action,
  details,
  isError = false,
  errorMsg = null,
) => {
  if (!orgId) return;
  try {
    const integration = await IssueTrackerIntegration.findOne({
      organization: orgId,
      provider,
    });
    if (integration) {
      integration.lastSyncAt = new Date();
      integration.lastSyncStatus = isError ? "error" : "success";
      if (isError) integration.lastSyncError = errorMsg;
      integration.syncCount = (integration.syncCount || 0) + 1;
      const log = {
        timestamp: new Date(),
        action,
        status: isError ? "error" : "success",
        details,
        error: errorMsg,
      };
      integration.syncLogs = [log, ...(integration.syncLogs || [])].slice(
        0,
        15,
      );
      await integration.save();
    }
  } catch (e) {
    console.error("Failed recording sync log:", e);
  }
};

/**
 * Helper to verify Linear webhook signature using HMAC-SHA256 and timing-safe comparison.
 * Linear passes the HMAC digest in the `Linear-Signature` header.
 */
export const verifyLinearSignature = (req) => {
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!secret) {
    return {
      isValid: false,
      reason: "LINEAR_WEBHOOK_SECRET is not configured",
    };
  }

  const signature =
    req.headers["linear-signature"] || req.headers["x-linear-signature"];
  if (!signature) {
    return { isValid: false, reason: "Missing Linear signature header" };
  }

  const rawPayload = req.rawBody
    ? req.rawBody
    : typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body);

  const computedHex = crypto
    .createHmac("sha256", secret)
    .update(rawPayload)
    .digest("hex");

  const sigBuf = Buffer.from(String(signature).toLowerCase());
  const compBuf = Buffer.from(computedHex.toLowerCase());

  if (
    sigBuf.length !== compBuf.length ||
    !crypto.timingSafeEqual(sigBuf, compBuf)
  ) {
    return { isValid: false, reason: "Invalid Linear signature" };
  }

  return { isValid: true };
};

/**
 * Helper to verify Jira webhook signature or bearer token authorization.
 * Jira passes authorization tokens or signatures in `authorization` or `x-jira-signature` headers.
 */
export const verifyJiraSignature = (req) => {
  const secret = process.env.JIRA_WEBHOOK_SECRET;
  if (!secret) {
    return { isValid: false, reason: "JIRA_WEBHOOK_SECRET is not configured" };
  }

  const signature =
    req.headers["x-jira-signature"] ||
    req.headers["x-hub-signature"] ||
    req.headers["authorization"] ||
    req.headers["x-atlassian-webhook-secret"];

  if (!signature) {
    return {
      isValid: false,
      reason: "Missing Jira authorization header or signature",
    };
  }

  const rawPayload = req.rawBody
    ? req.rawBody
    : typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body);

  if (signature.startsWith("sha256=")) {
    const signatureHash = signature.slice(7);
    const computedHash = crypto
      .createHmac("sha256", secret)
      .update(rawPayload)
      .digest("hex");

    const sigBuf = Buffer.from(signatureHash.toLowerCase());
    const compBuf = Buffer.from(computedHash.toLowerCase());

    if (
      sigBuf.length !== compBuf.length ||
      !crypto.timingSafeEqual(sigBuf, compBuf)
    ) {
      return { isValid: false, reason: "Invalid Jira HMAC signature" };
    }
  } else {
    const token = signature.replace(/^Bearer\s+/i, "");
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);

    if (
      tokenBuf.length !== secretBuf.length ||
      !crypto.timingSafeEqual(tokenBuf, secretBuf)
    ) {
      return { isValid: false, reason: "Invalid Jira secret token" };
    }
  }

  return { isValid: true };
};

/**
 * Handle incoming webhooks from Jira
 */
export const handleJiraWebhook = async (req, res) => {
  try {
    // Verify webhook signature / authorization
    const verification = verifyJiraSignature(req);
    if (!verification.isValid) {
      return res.status(401).json({
        success: false,
        message: verification.reason,
      });
    }

    const payload = req.body;

    // Jira webhook payloads usually have `webhookEvent`, `issue`, etc.
    if (payload && payload.issue && payload.issue.key) {
      const issueKey = payload.issue.key;
      const fields = payload.issue.fields || {};
      const statusName = fields.status?.name?.toLowerCase();

      // Status mapping
      let newStatus = null;
      if (
        statusName === "done" ||
        statusName === "completed" ||
        statusName === "closed"
      ) {
        newStatus = "completed";
      } else if (statusName === "in progress") {
        newStatus = "in-progress";
      } else if (statusName === "to do" || statusName === "open") {
        newStatus = "open";
      }

      // Find corresponding ActionItem
      const actionItem = await ActionItem.findOne({
        externalJiraIssueId: issueKey,
      });

      if (actionItem) {
        let changed = false;

        if (newStatus && actionItem.status !== newStatus) {
          actionItem.status = newStatus;
          if (newStatus === "completed") {
            actionItem.completedAt = new Date();
          }
          changed = true;
        }

        if (fields.summary && fields.summary !== actionItem.text) {
          actionItem.text = fields.summary;
          changed = true;
        }

        if (fields.duedate) {
          const parsedDueDate = new Date(fields.duedate);
          if (
            !isNaN(parsedDueDate.getTime()) &&
            String(actionItem.dueDate) !== String(parsedDueDate)
          ) {
            actionItem.dueDate = parsedDueDate;
            changed = true;
          }
        }

        if (changed) {
          await actionItem.save();
        }

        await recordSyncLog(
          actionItem.organization,
          "jira",
          "inbound_webhook",
          `Updated action item from Jira issue ${issueKey}`,
        );
      }
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing Jira webhook:", error);
    return res.status(500).send("Server Error");
  }
};

/**
 * Handle incoming webhooks from Linear
 */
export const handleLinearWebhook = async (req, res) => {
  try {
    // Verify webhook signature using Linear-Signature header
    const verification = verifyLinearSignature(req);
    if (!verification.isValid) {
      return res.status(401).json({
        success: false,
        message: verification.reason,
      });
    }

    const payload = req.body;

    if (
      payload &&
      (payload.action === "update" || payload.action === "create") &&
      payload.type === "Issue"
    ) {
      const issueId = payload.data?.id;
      const stateName = payload.data?.state?.name?.toLowerCase();
      const issueTitle = payload.data?.title;
      const dueDate = payload.data?.dueDate;

      // Status mapping based on typical Linear states
      let newStatus = null;
      if (
        stateName === "done" ||
        stateName === "completed" ||
        stateName === "canceled"
      ) {
        newStatus = "completed";
      } else if (stateName === "in progress") {
        newStatus = "in-progress";
      } else if (stateName === "todo" || stateName === "backlog") {
        newStatus = "open";
      }

      if (issueId) {
        const actionItem = await ActionItem.findOne({
          externalLinearIssueId: issueId,
        });

        if (actionItem) {
          let changed = false;

          if (newStatus && actionItem.status !== newStatus) {
            actionItem.status = newStatus;
            if (newStatus === "completed") {
              actionItem.completedAt = new Date();
            }
            changed = true;
          }

          if (issueTitle && issueTitle !== actionItem.text) {
            actionItem.text = issueTitle;
            changed = true;
          }

          if (dueDate) {
            const parsedDueDate = new Date(dueDate);
            if (
              !isNaN(parsedDueDate.getTime()) &&
              String(actionItem.dueDate) !== String(parsedDueDate)
            ) {
              actionItem.dueDate = parsedDueDate;
              changed = true;
            }
          }

          if (changed) {
            await actionItem.save();
          }

          await recordSyncLog(
            actionItem.organization,
            "linear",
            "inbound_webhook",
            `Updated action item from Linear issue ${issueId}`,
          );
        }
      }
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing Linear webhook:", error);
    return res.status(500).send("Server Error");
  }
};
