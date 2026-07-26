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
  googleCalendarAuth,
  googleCalendarCallback,
} from "../controllers/authControllers.js";
import userAuth from "../middleware/userAuth.js";
import {
  loginLimiter,
  registerLimiter,
  otpLimiter,
} from "../middleware/rateLimiter.js";

const router = express.Router();

// ✅ Auth routes with rate limiting
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/logout", logout);

// ✅ Verification & password reset with rate limiting
router.post("/send-verify-otp", otpLimiter, userAuth, sendVerifyOtp);
router.post("/verify-email", otpLimiter, userAuth, verifyEmail);
router.post("/send-reset-otp", otpLimiter, sendResetOtp);
router.post("/reset-password", otpLimiter, resetPassword);

// ✅ Dashboard & auth status
router.get("/user-data", userAuth, getUserData);

// 🔥 FIXED: Add this route for frontend login check
router.get("/is-auth", userAuth, isAuthenticated);

// ✅ Google Calendar Auth
router.get("/test-123", (req, res) => res.send("working"));
router.get("/google-calendar", googleCalendarAuth);
router.get("/google-calendar/callback", googleCalendarCallback);

export default router;
