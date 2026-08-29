import mongoose from "mongoose";

/**
 * Tracks incoming webhook deliveries for Jira/Linear integrations (Issue #2660).
 *
 * Stores each inbound webhook event with provider, type, status, and error
 * details so admins can diagnose failed syncs without server log access.
 *
 * TTL index auto-purges entries after 30 days.
 */
const incomingWebhookEventLogSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["jira", "linear"],
      required: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["success", "failed", "ignored"],
      required: true,
      index: true,
    },
    error: {
      type: String,
      default: null,
    },
    processingTimeMs: {
      type: Number,
      default: 0,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    issueKey: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// Fast pagination of logs per organization
incomingWebhookEventLogSchema.index({ organizationId: 1, createdAt: -1 });

// TTL: auto-purge logs older than 30 days
incomingWebhookEventLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

const IncomingWebhookEventLog =
  mongoose.models.IncomingWebhookEventLog ||
  mongoose.model("IncomingWebhookEventLog", incomingWebhookEventLogSchema);

export default IncomingWebhookEventLog;
