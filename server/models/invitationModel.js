// server/models/invitationModel.js
import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "cancelled", "expired"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    message: {
      type: String,
      trim: true,
      maxlength: [500, "Message cannot exceed 500 characters"],
      default: "",
    },
  },
  { timestamps: true },
);

// Indexes for performance and uniqueness
invitationSchema.index({ token: 1 }, { unique: true });
invitationSchema.index({ email: 1, organization: 1, status: 1 });
invitationSchema.index({ organization: 1, status: 1 });
invitationSchema.index({ invitedBy: 1 });
invitationSchema.index({ expiresAt: 1 });
invitationSchema.index({ createdAt: -1 });

const Invitation =
  mongoose.models.Invitation || mongoose.model("Invitation", invitationSchema);

export default Invitation;
