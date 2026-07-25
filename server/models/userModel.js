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
  },
  { timestamps: true },
);

const userModel = mongoose.models.user || mongoose.model("user", userSchema);
if (!mongoose.models.User) {
  mongoose.model("User", userSchema);
}

export default userModel;
