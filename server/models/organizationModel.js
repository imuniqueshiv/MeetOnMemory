import mongoose from "mongoose";
import { encryptToken, decryptToken } from "../utils/crypto.js";

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
    about: {
      type: String,
      trim: true,
      maxlength: [2000, "About bio cannot exceed 2000 characters"],
      default: "",
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    industry: {
      type: String,
      trim: true,
      maxlength: [100, "Industry cannot exceed 100 characters"],
      default: "",
    },
    location: {
      type: String,
      trim: true,
      maxlength: [100, "Location cannot exceed 100 characters"],
      default: "",
    },
    logo: {
      type: String,
      default: "",
      // Logo image URL (external or future upload CDN URL)
      maxlength: [2048, "Logo URL cannot exceed 2048 characters"],
    },
    // Cover/banner image URL (external or future upload CDN URL)
    bannerUrl: {
      type: String,
      default: "",
      maxlength: [2048, "Banner URL cannot exceed 2048 characters"],
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
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
        },
        role: {
          type: String,
          enum: ["owner", "admin", "member", "viewer"],
          default: "member",
        },
        invitedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "user",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["active", "invited", "suspended"],
          default: "active",
        },
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

    // E2EE Feature Flag & Rollout Settings (#2263)
    e2eeSettings: {
      enabled: {
        type: Boolean,
        default: false,
      },
      enforceOrgWide: {
        type: Boolean,
        default: false,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

organizationSchema
  .virtual("slackBotToken")
  .get(function () {
    return decryptToken(this.slackIntegration?.botToken);
  })
  .set(function (value) {
    if (!this.slackIntegration) {
      this.slackIntegration = {};
    }
    this.slackIntegration.botToken = encryptToken(value);
  });

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
