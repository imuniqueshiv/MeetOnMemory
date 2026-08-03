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
    // Lightweight aggregate analytics (no visitor identity / IP)
    totalViews: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastAccessed: {
      type: Date,
      default: null,
    },
    failedPasscodeAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

export default mongoose.model("SharedLink", sharedLinkSchema);
