import { sendSuccess, sendError } from "../utils/responseHandler.js";
import AuthService from "../services/AuthService.js";
import { provisionOrLinkClerkUser } from "../services/authLinkingService.js";
import { AccountMergeError } from "../services/userAccountMergeService.js";

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
    console.error("Register error:", error.message);
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
    console.error("Login error:", error.message);
    res.json({ success: false, message: error.message });
  }
};

// --------------------------- LOGOUT ---------------------------
const DIAG = "[SYNC-CLERK-DIAG]";

/**
 * Clerk-aware logout acknowledgement.
 * Client must call Clerk signOut; server clears any residual legacy cookie.
 */
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

    res.json({ success: true, message: "Verification OTP sent on email" });
  } catch (error) {
    console.error("SendVerifyOtp error:", error.message);
    // Maintain old generic error for sendVerifyOtp to not break tests if it relies on exact string
    if (
      error.message === "Authentication failed" ||
      error.message === "Account already verified"
    ) {
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

// --------------------------- SEND PASSWORD RESET OTP ---------------------------
export const sendResetOtp = async (req, res) => {
  const { email } = req.body;
  if (!validateFields({ email }, res)) return;

  try {
    await AuthService.sendResetOtp({ email });

    res.json({ success: true, message: "OTP sent to your email" });
  } catch (error) {
    console.error("SendResetOtp error:", error.message);
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

// --------------------------- CHECK AUTH ---------------------------
export const isAuthenticated = async (req, res) => {
  try {
    return sendSuccess(res);
  } catch (error) {
    sendError(res, 400, error.message);
  }
};

export const getUserData = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await AuthService.getUserData(userId);
    sendSuccess(res, { user });
  } catch (error) {
    console.error("Error fetching user data:", error.message);
    if (error.statusCode === 404) {
      sendError(res, 404, "User not found");
    } else {
      sendError(res, 500, "Server error");
    }
  }
};

export const syncClerkUser = async (req, res) => {
  // TEMP DIAGNOSTIC — remove after root-cause confirmed in Render logs
  console.error(`${DIAG} 1. Request entered syncClerkUser`, {
    method: req.method,
    url: req.originalUrl || req.url,
    hasAuthHeader: Boolean(
      req.headers?.authorization || req.headers?.Authorization,
    ),
    bodyKeys: req.body ? Object.keys(req.body) : [],
    reqUserId: req.user?._id?.toString?.() || req.user?.id || null,
    reqUserClerkId: req.user?.clerkUserId || null,
    reqUserEmail: req.user?.email || null,
    reqAuthClerkId: req.auth?.clerkUserId || null,
  });

  try {
    // Issue #1104: identity comes only from the verified Clerk JWT (req.auth),
    // populated by userAuth. Request-body clerkUserId / email / etc. are ignored
    // so clients cannot force unauthorized account linking.
    const authIdentity = req.auth;
    const clerkUserId = authIdentity?.clerkUserId;

    console.error(`${DIAG} 3/4. Resolved sync inputs (JWT only)`, {
      clerkUserId: clerkUserId || null,
      email: authIdentity?.email || null,
      name: authIdentity?.name || null,
      hasProfilePic: Boolean(authIdentity?.profilePic),
      ignoredBodyIdentityKeys: [
        "clerkUserId",
        "email",
        "name",
        "profilePic",
      ].filter(
        (key) =>
          req.body && Object.prototype.hasOwnProperty.call(req.body, key),
      ),
    });

    if (!clerkUserId) {
      console.error(`${DIAG} FAIL early: verified JWT identity missing`);
      return sendError(
        res,
        401,
        "Authenticated Clerk identity is required for sync",
      );
    }

    console.error(`${DIAG} Calling provisionOrLinkClerkUser…`);
    const user = await provisionOrLinkClerkUser({
      clerkUserId,
      email: authIdentity.email,
      name: authIdentity.name,
      profilePic: authIdentity.profilePic,
    });

    console.error(`${DIAG} provisionOrLinkClerkUser returned`, {
      mongoUserId: user?._id?.toString?.() || user?.id || null,
      clerkUserId: user?.clerkUserId || null,
      email: user?.email || null,
      role: user?.role ?? null,
      organization:
        user?.organization?.toString?.() || user?.organization || null,
      hasCompletedOnboarding: user?.hasCompletedOnboarding,
    });

    console.error(
      `${DIAG} 9. Organization bootstrap: NOT invoked on this path (identity sync only)`,
    );

    return sendSuccess(res, { user }, "User synchronized successfully");
  } catch (error) {
    if (error instanceof AccountMergeError) {
      return sendError(
        res,
        409,
        error.message || "Failed to sync user due to account conflict",
      );
    }
    // Do not swallow — dump full exception for Render logs
    console.error(`${DIAG} EXCEPTION in syncClerkUser`);
    console.error(error);
    console.error(error?.stack);
    console.error(`${DIAG} exception meta`, {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      keyPattern: error?.keyPattern,
      keyValue: error?.keyValue,
      errors: error?.errors
        ? Object.fromEntries(
            Object.entries(error.errors).map(([k, v]) => [
              k,
              {
                message: v?.message,
                kind: v?.kind,
                path: v?.path,
                value: v?.value,
              },
            ]),
          )
        : undefined,
    });
    return sendError(res, 500, error.message || "Failed to sync user");
  }
};
