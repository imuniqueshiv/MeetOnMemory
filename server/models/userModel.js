// server/models/userModel.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    verifyOtp: { type: String, default: "" },
    verifyOtpExpireAt: { type: Number, default: 0 },
    isAccountVerified: { type: Boolean, default: false },
    resetOtp: { type: String, default: "" },
    resetOtpExpireAt: { type: Number, default: 0 },

    // --- NEW FIELDS ADDED ---
    clerkUserId: {
      type: String,
      sparse: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ["owner", "admin", "moderator", "member", "guest"],
      default: null, // Will be null until they complete onboarding
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization", // This links to the Organization model
      default: null,
    },
    team: {
      type: String,
      default: null,
    },
    hasCompletedOnboarding: {
      type: Boolean,
      default: false,
    },
    profilePic: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
    },
    googleAccessToken: {
      type: String,
      default: null,
    },
    googleRefreshToken: {
      type: String,
      default: null,
    },
    calendarSyncEnabled: {
      type: Boolean,
      default: false,
    },
    dashboardPreferences: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    lastExportRequestedAt: {
      type: Date,
      default: null,
    },
    lastExportFile: {
      type: String,
      default: null,
    },
    lastExportStatus: {
      type: String,
      enum: ["idle", "processing", "completed", "failed"],
      default: "idle",
    },
    lastExportError: {
      type: String,
      default: null,
    },
    emailDigestEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

userSchema.index({ organization: 1 });
userSchema.index({ organization: 1, role: 1 });

const userModel = mongoose.models.user || mongoose.model("user", userSchema);
if (!mongoose.models.User) {
  mongoose.model("User", userSchema);
}

export default userModel;
