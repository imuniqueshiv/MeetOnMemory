import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      maxlength: [100, "Organization name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: [true, "Organization slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9-]+$/,
        "Slug can only contain lowercase letters, numbers, and hyphens",
      ],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    logo: {
      type: String,
      default: "",
    },
    visibility: {
      type: String,
      enum: ["public", "private", "invite-only"],
      default: "private",
    },
    joinPolicy: {
      type: String,
      enum: ["open", "approval_required", "invite_only"],
      default: "open",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    // Deprecated: Use Membership model instead
    // Kept for backward compatibility during migration
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    ],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    //Slack Integration
    slackIntegration: {
      botToken: {
        type: String,
        default: "",
        select: false,
      },
      channelId: {
        type: String,
        default: "",
      },
      teamId: {
        type: String,
        default: "",
      },
      teamName: {
        type: String,
        default: "",
      },
      installedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true },
);

// Indexes for performance

organizationSchema.index({ owner: 1 });
organizationSchema.index({ visibility: 1 });
organizationSchema.index({ createdAt: -1 });
// Indexes for organization discovery and search
organizationSchema.index({ name: "text", slug: "text", description: "text" });
organizationSchema.index({ visibility: 1, createdAt: -1 });
organizationSchema.index({ visibility: 1, name: 1 });
// Sparse index: only indexes documents that actually have a Slack teamId
organizationSchema.index({ "slackIntegration.teamId": 1 }, { sparse: true });

const Organization =
  mongoose.models.Organization ||
  mongoose.model("Organization", organizationSchema);

export default Organization;
