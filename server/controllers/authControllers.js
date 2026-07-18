import { getAuthUrl } from "../services/calendarService.js";
import AuthService from "../services/AuthService.js";

// --------------------------- HELPERS ---------------------------
const validateFields = (fields, res) => {
  const missing = Object.entries(fields).filter(([_, val]) => !val);
  if (missing.length > 0) {
    res.json({ success: false, message: "Missing details" });
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

    return res
      .status(201)
      .json({ success: true, message: "Registration successful" });
  } catch (error) {
    console.error("Register error:", error);
    res.json({ success: false, message: error.message });
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

    return res.json({ success: true, message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error);
    res.json({ success: false, message: error.message });
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
    return res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// --------------------------- SEND VERIFY OTP ---------------------------
export const sendVerifyOtp = async (req, res) => {
  try {
    const { userId } = req;
    
    await AuthService.sendVerifyOtp(userId);

    res.json({ success: true, message: "Verification OTP sent on email" });
  } catch (error) {
    console.error("SendVerifyOtp error:", error);
    // Maintain old generic error for sendVerifyOtp to not break tests if it relies on exact string
    if (error.message === "Authentication failed" || error.message === "Account already verified") {
      res.json({ success: false, message: error.message });
    } else {
      res.json({ success: false, message: "Failed to send verification OTP" });
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

    return res.json({ success: true, message: "Email verified successfully!" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// --------------------------- CHECK AUTH ---------------------------
export const isAuthenticated = async (req, res) => {
  try {
    return res.json({ success: true });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// --------------------------- SEND PASSWORD RESET OTP ---------------------------
export const sendResetOtp = async (req, res) => {
  const { email } = req.body;
  if (!validateFields({ email }, res)) return;

  try {
    await AuthService.sendResetOtp({ email });

    res.json({ success: true, message: "OTP sent to your email" });
  } catch (error) {
    console.error("SendResetOtp error:", error);
    res.json({
      success: false,
      message: "Failed to process password reset request",
    });
  }
};

// --------------------------- RESET PASSWORD ---------------------------
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!validateFields({ email, otp, newPassword }, res)) return;

  try {
    await AuthService.resetPassword({ email, otp, newPassword });

    return res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// --------------------------- GET USER DATA (For Dashboard) ---------------------------
export const getUserData = async (req, res) => {
  try {
    const user = await AuthService.getUserData(req.user.id);

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("Error fetching user data:", error);
    if (error.statusCode === 404) {
      res.status(404).json({ success: false, message: "User not found" });
    } else {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};

// --------------------------- GOOGLE CALENDAR AUTH ---------------------------
export const googleCalendarAuth = (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
};

export const googleCalendarCallback = async (req, res) => {
  const { code } = req.query;
  try {
    const token = req.cookies?.token;
    await AuthService.googleCalendarCallback({ code, token });

    res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/profile?sync=success`);
  } catch (error) {
    console.error("Google Calendar Callback error:", error);
    if (error.statusCode === 401) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    } else if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/profile?sync=error`);
  }
};
