// server/models/membershipModel.js
import mongoose from "mongoose";

const membershipSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },
    status: {
      type: String,
      enum: ["active", "suspended", "removed"],
      default: "active",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    engagementScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    engagementBreakdown: {
      meetingsCreated: { type: Number, default: 0 },
      meetingsAttended: { type: Number, default: 0 },
      decisionsContributed: { type: Number, default: 0 },
      actionItemsResolved: { type: Number, default: 0 },
      liveMeetingParticipation: { type: Number, default: 0 },
      policiesUploaded: { type: Number, default: 0 },
      lastActivityAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

// Compound index to prevent duplicate memberships
membershipSchema.index({ user: 1, organization: 1 }, { unique: true });
membershipSchema.index({ organization: 1, status: 1 });
membershipSchema.index({ user: 1, status: 1 });
membershipSchema.index({ joinedAt: -1 });
membershipSchema.index({ organization: 1, engagementScore: -1 });

const Membership =
  mongoose.models.Membership || mongoose.model("Membership", membershipSchema);

export default Membership;
