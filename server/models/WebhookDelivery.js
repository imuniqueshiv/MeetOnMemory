import mongoose from "mongoose";

const webhookDeliverySchema = new mongoose.Schema(
  {
    webhookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Webhook",
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    event: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    responseStatus: {
      type: Number,
      default: null,
    },
    responseHeaders: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    responseBody: {
      type: String,
      default: null,
    },
    executionTimeMs: {
      type: Number,
      default: 0,
    },
    attempt: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["success", "failed", "dlq"],
      required: true,
      index: true,
    },
    errorReason: {
      type: String,
      default: null,
    },
    nextRetryAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Composite index for fast pagination of deliveries by webhook
webhookDeliverySchema.index({ webhookId: 1, createdAt: -1 });
webhookDeliverySchema.index({ organizationId: 1, createdAt: -1 });
// TTL index: Automatically purge delivery audit logs older than 30 days
webhookDeliverySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

const WebhookDelivery =
  mongoose.models.WebhookDelivery ||
  mongoose.model("WebhookDelivery", webhookDeliverySchema);

export default WebhookDelivery;
