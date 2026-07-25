import mongoose from "mongoose";

const sharedLinkSchema = new mongoose.Schema(
  {
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "resourceModel",
    },
    resourceModel: {
      type: String,
      required: true,
      enum: ["Meeting", "Policy"],
    },
    hash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expirationDate: {
      type: Date,
    },
    passcode: {
      type: String, // hashed passcode
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Create index for automatic expiry of documents? No, better to keep it soft-deleted or just check expiration date.
// If we want automatic deletion, we could use a TTL index, but keeping the record for audit is better.
// sharedLinkSchema.index({ expirationDate: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("SharedLink", sharedLinkSchema);
