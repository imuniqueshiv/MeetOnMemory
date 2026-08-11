import mongoose from "mongoose";
import crypto from "crypto";

const webhookSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    targetUrl: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v) {
          return typeof v === "string" && v.startsWith("https://");
        },
        message: "Target URL must start with https://",
      },
    },
    events: {
      type: [String],
      default: [],
      // e.g. ["meeting.created", "mom.generated", "policy.updated"]
    },
    secret: {
      type: String,
      required: true,
      default: () => crypto.randomBytes(32).toString("hex"),
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    consecutiveFailures: {
      type: Number,
      default: 0,
    },
    healthStatus: {
      type: String,
      enum: ["healthy", "degraded", "paused"],
      default: "healthy",
    },
    lastDeliveredAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

const Webhook =
  mongoose.models.Webhook || mongoose.model("Webhook", webhookSchema);

export default Webhook;
