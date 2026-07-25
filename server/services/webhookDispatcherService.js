import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import crypto from "crypto";
import axios from "axios";
import Webhook from "../models/Webhook.js";
import WebhookDelivery from "../models/WebhookDelivery.js";
import eventBus from "./eventBus.js";

// Redis connection management
let _producerConnection = null;
let _workerConnection = null;
let _webhookQueueInstance = null;

function getProducerConnection() {
  if (!process.env.REDIS_URI) return null;
  if (!_producerConnection) {
    _producerConnection = new Redis(process.env.REDIS_URI, {
      maxRetriesPerRequest: 3, // Fail fast for requests adding tasks to queue
      family: 0,
    });
    _producerConnection.on("error", (err) => {
      console.error("⚠️ Webhook Producer Redis Connection Error:", err.message);
    });
  }
  return _producerConnection;
}

function getWorkerConnection() {
  if (!process.env.REDIS_URI) return null;
  if (!_workerConnection) {
    _workerConnection = new Redis(process.env.REDIS_URI, {
      maxRetriesPerRequest: null, // Unlimited retries for background workers
      family: 0,
    });
    _workerConnection.on("error", (err) => {
      console.error("⚠️ Webhook Worker Redis Connection Error:", err.message);
    });
  }
  return _workerConnection;
}

function getWebhookQueue() {
  if (!process.env.REDIS_URI) return null;
  if (!_webhookQueueInstance) {
    const conn = getProducerConnection();
    if (conn) {
      _webhookQueueInstance = new Queue("webhook-dispatches", {
        connection: conn,
      });
    }
  }
  return _webhookQueueInstance;
}

export const webhookQueue = {
  add: async (...args) => {
    const q = getWebhookQueue();
    if (!q) {
      console.warn("⚠️ Queue operation ignored: Redis is not configured.");
      return null;
    }
    return await q.add(...args);
  },
  get isActive() {
    return getWebhookQueue() !== null;
  },
};

/**
 * Signs the payload using HMAC SHA-256 with the webhook's secret and a timestamp.
 * Provides replay protection for downstream consumers.
 * @param {object|string} payload - Webhook payload object
 * @param {string} timestamp - ISO timestamp
 * @param {string} secret - Webhook secret key
 * @returns {string} Hex signature
 */
export const generateSignature = (payload, timestamp, secret) => {
  const content = `${timestamp}.${typeof payload === "string" ? payload : JSON.stringify(payload)}`;
  return crypto.createHmac("sha256", secret).update(content).digest("hex");
};

/**
 * Core dispatch function. Sends signed POST request to client url and logs delivery status.
 * @param {string} webhookId - MongoDB Webhook Subscription ID
 * @param {object} payload - Payload object containing event details
 * @param {object} [options] - Additional dispatch options (attempt count, isFinalAttempt)
 * @returns {Promise<object>} Created WebhookDelivery record
 */
export const performDispatch = async (webhookId, payload, options = {}) => {
  const attempt = options.attempt || 1;
  const isFinalAttempt = options.isFinalAttempt || false;

  const webhook = await Webhook.findById(webhookId).select("+secret");
  if (!webhook || !webhook.isActive) {
    console.log(
      `⚠️ Webhook subscription ${webhookId} not found or inactive. Skipping.`,
    );
    return null;
  }

  const timestamp = new Date().toISOString();
  const signature = generateSignature(payload, timestamp, webhook.secret);
  const startTime = Date.now();

  try {
    console.log(
      `📡 Sending webhook event '${payload.event}' to ${webhook.targetUrl} (Attempt ${attempt})...`,
    );

    const response = await axios.post(webhook.targetUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-meetonmemory-signature": signature,
        "x-meetonmemory-request-timestamp": timestamp,
      },
      timeout: 10000, // 10 second timeout
    });

    const sanitizeHeaders = (headers) => {
      if (!headers || typeof headers !== "object") return null;
      const sanitized = { ...headers };
      delete sanitized["set-cookie"];
      delete sanitized["authorization"];
      delete sanitized["cookie"];
      delete sanitized["x-auth-token"];
      return sanitized;
    };

    const executionTimeMs = Date.now() - startTime;

    // Log successful delivery attempt
    const delivery = await WebhookDelivery.create({
      webhookId: webhook._id,
      organizationId: webhook.organizationId,
      event: payload.event || "custom",
      payload,
      responseStatus: response.status,
      responseHeaders: sanitizeHeaders(response.headers),
      responseBody:
        typeof response.data === "string"
          ? response.data.slice(0, 2000)
          : JSON.stringify(response.data || {}).slice(0, 2000),
      executionTimeMs,
      attempt,
      status: "success",
    });

    // Reset failure counts and update health status
    await Webhook.findByIdAndUpdate(webhookId, {
      consecutiveFailures: 0,
      healthStatus: "healthy",
      lastDeliveredAt: new Date(),
    });

    console.log(
      `✅ Webhook event '${payload.event}' successfully sent to ${webhook.targetUrl}. Status: ${response.status}`,
    );

    return delivery;
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const responseStatus = error.response ? error.response.status : null;
    const responseHeaders = error.response
      ? { ...error.response.headers }
      : null;
    if (responseHeaders) {
      delete responseHeaders["set-cookie"];
      delete responseHeaders["authorization"];
      delete responseHeaders["cookie"];
      delete responseHeaders["x-auth-token"];
    }

    const responseBody = error.response?.data
      ? typeof error.response.data === "string"
        ? error.response.data.slice(0, 2000)
        : JSON.stringify(error.response.data).slice(0, 2000)
      : null;

    const errorMsg = responseStatus
      ? `HTTP Status ${responseStatus}`
      : error.message;
    const deliveryStatus = isFinalAttempt ? "dlq" : "failed";

    // Create failed/dlq delivery record
    const _delivery = await WebhookDelivery.create({
      webhookId: webhook._id,
      organizationId: webhook.organizationId,
      event: payload.event || "custom",
      payload,
      responseStatus,
      responseHeaders,
      responseBody,
      executionTimeMs,
      attempt,
      status: deliveryStatus,
      errorReason: errorMsg,
    });

    // Atomically increment consecutive failures to prevent race conditions across concurrent workers
    const updatedWebhook = await Webhook.findByIdAndUpdate(
      webhookId,
      { $inc: { consecutiveFailures: 1 } },
      { new: true },
    );

    if (updatedWebhook) {
      const newFailures = updatedWebhook.consecutiveFailures;
      let newHealthStatus = updatedWebhook.healthStatus;
      let newIsActive = updatedWebhook.isActive;

      if (newFailures >= 15) {
        newHealthStatus = "paused";
        newIsActive = false;
        console.warn(
          `🚨 Webhook ${updatedWebhook._id} (${updatedWebhook.targetUrl}) reached 15 consecutive failures. Auto-pausing subscription.`,
        );
      } else if (newFailures >= 10) {
        newHealthStatus = "degraded";
        console.warn(
          `⚠️ Webhook ${updatedWebhook._id} (${updatedWebhook.targetUrl}) health degraded (${newFailures} consecutive failures).`,
        );
      }

      if (
        newHealthStatus !== updatedWebhook.healthStatus ||
        newIsActive !== updatedWebhook.isActive
      ) {
        await Webhook.findByIdAndUpdate(webhookId, {
          healthStatus: newHealthStatus,
          isActive: newIsActive,
        });
      }
    }

    console.error(
      `❌ Webhook dispatch failed for ${webhook.targetUrl} (Attempt ${attempt}): ${errorMsg}`,
    );

    if (deliveryStatus === "dlq") {
      console.error(
        `☠️ Webhook dispatch payload moved to Dead-Letter Queue (DLQ) after ${attempt} attempts.`,
      );
    }

    // Throwing error allows BullMQ to retry if not in final attempt
    throw new Error(`Webhook dispatch failed: ${errorMsg}`);
  }
};

/**
 * Redelivers a specific past webhook delivery payload manually.
 * @param {string} deliveryId - MongoDB WebhookDelivery ID
 * @returns {Promise<object>} New WebhookDelivery audit record
 */
export const redeliverWebhookDelivery = async (deliveryId) => {
  const originalDelivery = await WebhookDelivery.findById(deliveryId);
  if (!originalDelivery) {
    throw new Error("Webhook delivery record not found.");
  }

  return await performDispatch(
    originalDelivery.webhookId,
    originalDelivery.payload,
    {
      attempt: originalDelivery.attempt + 1,
      isFinalAttempt: false,
    },
  );
};

/**
 * Dispatches the event payload to all active webhooks subscribed to this event in the organization.
 * @param {string} organizationId - Target organization ID
 * @param {string} event - Event name (e.g. 'meeting.created')
 * @param {object} data - Event data payload
 */
export const dispatchWebhookEvent = async (organizationId, event, data) => {
  if (!organizationId) {
    return;
  }

  try {
    // Find active webhooks for this organization that subscribe to this specific event
    const webhooks = await Webhook.find({
      organizationId,
      events: event,
      isActive: true,
    });

    if (webhooks.length === 0) {
      return;
    }

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    for (const webhook of webhooks) {
      if (getWebhookQueue()) {
        // Add to BullMQ with exponential backoff retries for reliability
        await webhookQueue.add(
          "dispatch-webhook",
          { webhookId: webhook._id, payload },
          {
            attempts: 5,
            backoff: {
              type: "exponential",
              delay: 2000, // 2s initial delay
            },
          },
        );
      } else {
        // Fallback: Synchronous dispatch in local/dev environment without Redis
        performDispatch(webhook._id, payload, {
          attempt: 1,
          isFinalAttempt: true,
        }).catch((err) => {
          console.error(
            "⚠️ Local webhook dispatch sync fallback failed:",
            err.message,
          );
        });
      }
    }
  } catch (err) {
    console.error("⚠️ Failed to queue webhook dispatches:", err.message);
  }
};

/**
 * Initializes the Webhook worker listening on the dispatch queue.
 */
export const initWebhookWorker = () => {
  const connection = getWorkerConnection();
  if (!connection) {
    console.warn(
      "⚠️ Redis not configured. Webhook background worker will not start (falling back to sync dispatch).",
    );
    return;
  }

  const worker = new Worker(
    "webhook-dispatches",
    async (job) => {
      const { webhookId, payload } = job.data;
      const attempt = job.attemptsMade + 1;
      const maxAttempts = job.opts?.attempts || 5;
      const isFinalAttempt = attempt >= maxAttempts;

      await performDispatch(webhookId, payload, { attempt, isFinalAttempt });
    },
    { connection, concurrency: 10 },
  );

  worker.on("completed", (job) => {
    console.log(`✅ Webhook job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `❌ Webhook job ${job.id} failed attempt ${job.attemptsMade}:`,
      err.message,
    );
  });

  worker.on("error", (err) => {
    console.error("❌ Webhook Worker error:", err.message);
  });

  console.log(
    "✅ Webhook Worker initialized and listening to webhook-dispatches queue",
  );
};

// ─────────────────────────────────────────────────────────────
// 📡 Register internal event bus listeners to fire webhooks
// ─────────────────────────────────────────────────────────────

eventBus.on("meeting.created", (meeting) => {
  const orgId = meeting?.organization;
  if (!orgId) return;

  const data = {
    meetingId: meeting._id,
    title: meeting.title,
    description: meeting.description,
    date: meeting.date,
    meetingType: meeting.meetingType,
    organizationId: orgId,
  };

  dispatchWebhookEvent(orgId, "meeting.created", data);
});

eventBus.on("mom.generated", (meeting) => {
  const orgId = meeting?.organization;
  if (!orgId) return;

  const data = {
    meetingId: meeting._id,
    title: meeting.title,
    summary: meeting.summary,
    structuredMoM: meeting.structuredMoM,
    organizationId: orgId,
  };

  dispatchWebhookEvent(orgId, "mom.generated", data);
});

eventBus.on("policy.updated", (policy) => {
  const orgId = policy.organization;
  if (!orgId) return;

  const data = {
    policyId: policy._id,
    name: policy.name,
    version: policy.version,
    summary: policy.summary,
    key_changes: policy.key_changes,
    keywords: policy.keywords,
    organizationId: orgId,
  };

  dispatchWebhookEvent(orgId, "policy.updated", data);
});
