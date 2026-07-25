import { getGoogleAuthUrl } from "../services/calendarService.js";
import AuthService from "../services/AuthService.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

// --------------------------- HELPERS ---------------------------
const validateFields = (fields, res) => {
  const missing = Object.entries(fields).filter(([_, val]) => !val);
  if (missing.length > 0) {
    sendError(res, 400, "Missing details");
    return false;
  }
  return true;
};

// --------------------------- REGISTER ---------------------------
export const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!validateFields({ name, email, password }, res)) return;

  try {
    const { token } = await AuthService.register({ name, email, password });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendSuccess(res, {}, "Registration successful", 201);
  } catch (error) {
    console.error("Register error:", error);
    sendError(res, 400, error.message);
  }
};

// --------------------------- LOGIN ---------------------------
export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!validateFields({ email, password }, res)) return;

  try {
    const { token } = await AuthService.login({ email, password });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendSuccess(res, {}, "Login successful");
  } catch (error) {
    console.error("Login error:", error);
    sendError(res, 400, error.message);
  }
};

// --------------------------- LOGOUT ---------------------------
export const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    });
    return sendSuccess(res, {}, "Logged out successfully");
  } catch (error) {
    sendError(res, 400, error.message);
  }
};

// --------------------------- SEND VERIFY OTP ---------------------------
export const sendVerifyOtp = async (req, res) => {
  try {
    const { userId } = req;

    await AuthService.sendVerifyOtp(userId);

    sendSuccess(res, {}, "Verification OTP sent on email");
  } catch (error) {
    console.error("SendVerifyOtp error:", error);
    // Maintain old generic error for sendVerifyOtp to not break tests if it relies on exact string
    if (
      error.message === "Authentication failed" ||
      error.message === "Account already verified"
    ) {
      sendError(res, 400, error.message);
    } else {
      sendError(res, 400, "Failed to send verification OTP");
    }
  }
};

// --------------------------- VERIFY EMAIL ---------------------------
export const verifyEmail = async (req, res) => {
  const { otp } = req.body;
  const { userId } = req;
  if (!validateFields({ userId, otp }, res)) return;

  try {
    await AuthService.verifyEmail({ userId, otp });

    return sendSuccess(res, {}, "Email verified successfully!");
  } catch (error) {
    sendError(res, 400, error.message);
  }
};

// --------------------------- CHECK AUTH ---------------------------
export const isAuthenticated = async (req, res) => {
  try {
    return sendSuccess(res);
  } catch (error) {
    sendError(res, 400, error.message);
  }
};

// --------------------------- SEND PASSWORD RESET OTP ---------------------------
export const sendResetOtp = async (req, res) => {
  const { email } = req.body;
  if (!validateFields({ email }, res)) return;

  try {
    await AuthService.sendResetOtp({ email });

    sendSuccess(res, {}, "OTP sent to your email");
  } catch (error) {
    console.error("SendResetOtp error:", error);
    sendError(res, 400, "Failed to process password reset request");
  }
};

// --------------------------- RESET PASSWORD ---------------------------
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!validateFields({ email, otp, newPassword }, res)) return;

  try {
    await AuthService.resetPassword({ email, otp, newPassword });

    return sendSuccess(res, {}, "Password has been reset successfully");
  } catch (error) {
    sendError(res, 400, error.message);
  }
};

// --------------------------- GET USER DATA (For Dashboard) ---------------------------
export const getUserData = async (req, res) => {
  try {
    const user = await AuthService.getUserData(req.user.id);

    sendSuccess(res, { user });
  } catch (error) {
    console.error("Error fetching user data:", error);
    if (error.statusCode === 404) {
      sendError(res, 404, "User not found");
    } else {
      sendError(res, 500, "Server error");
    }
  }
};

// --------------------------- GOOGLE CALENDAR AUTH ---------------------------
export const googleCalendarAuth = (req, res) => {
  const url = getGoogleAuthUrl();
  res.redirect(url);
};

export const googleCalendarCallback = async (req, res) => {
  const { code } = req.query;
  try {
    const token = req.cookies?.token;
    await AuthService.googleCalendarCallback({ code, token });

    res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:5173"}/profile?sync=success`,
    );
  } catch (error) {
    console.error("Google Calendar Callback error:", error);
    if (error.statusCode === 401) {
      return sendError(res, 401, "Not authenticated");
    } else if (error.statusCode === 404) {
      return sendError(res, 404, "User not found");
    }
    res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:5173"}/profile?sync=error`,
    );
  }
};
