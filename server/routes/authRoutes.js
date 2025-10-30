import express from "express";
import {
  register,
  login,
  logout,
  sendVerifyOtp,
  verifyEmail,
  isAuthenticated,
  sendResetOtp,
  resetPassword,
  getUserData,
} from "../controllers/authControllers.js";

import userAuth from "../middleware/userAuth.js";

const router = express.Router();

// ✅ Auth routes
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

// ✅ Verification & password reset
router.post("/send-verify-otp", userAuth, sendVerifyOtp);
router.post("/verify-email", userAuth, verifyEmail);
router.post("/send-reset-otp", sendResetOtp);
router.post("/reset-password", resetPassword);

// ✅ Dashboard & auth status
router.get("/user-data", userAuth, getUserData);

// 🔥 FIXED: Add this route for frontend login check
router.get("/is-auth", userAuth, isAuthenticated);

export default router;
