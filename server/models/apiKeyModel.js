import mongoose from "mongoose";

const apiKeySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Truncated key preview for UI (e.g., mom_live_...9f2a)
    keyPreview: {
      type: String,
      required: true,
    },
    // SHA-256 hash of the complete secret key
    hashedKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    scopes: {
      type: [String],
      enum: [
        "meetings:read",
        "meetings:write",
        "transcripts:read",
        "summaries:read",
        "action_items:read",
        "action_items:write",
        "webhooks:manage",
      ],
      default: ["meetings:read", "transcripts:read", "summaries:read"],
    },
    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    rateLimitPerMinute: {
      type: Number,
      default: 60,
    },
  },
  {
    timestamps: true,
  },
);

// Method to verify if key is expired
apiKeySchema.methods.isExpired = function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

const ApiKey = mongoose.model("ApiKey", apiKeySchema);
export default ApiKey;
