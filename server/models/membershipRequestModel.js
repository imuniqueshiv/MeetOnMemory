// server/models/membershipRequestModel.js
import mongoose from "mongoose";

const membershipRequestSchema = new mongoose.Schema(
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
    message: {
      type: String,
      trim: true,
      maxlength: [500, "Message cannot exceed 500 characters"],
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNotes: {
      type: String,
      trim: true,
      maxlength: [500, "Review notes cannot exceed 500 characters"],
      default: "",
    },
  },
  { timestamps: true },
);

// Compound index to prevent duplicate pending requests
membershipRequestSchema.index(
  { user: 1, organization: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
membershipRequestSchema.index({ organization: 1, status: 1 });
membershipRequestSchema.index({ user: 1, status: 1 });
membershipRequestSchema.index({ createdAt: -1 });

const MembershipRequest =
  mongoose.models.MembershipRequest ||
  mongoose.model("MembershipRequest", membershipRequestSchema);

export default MembershipRequest;
