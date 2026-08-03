import { sendSuccess, sendError } from "../utils/responseHandler.js";
import AuthService from "../services/AuthService.js";
import { provisionOrLinkClerkUser } from "../services/authLinkingService.js";

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
    console.error("Error fetching user data:", error);
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
  });

  try {
    const { clerkUserId, email, name, profilePic } = req.body || {};
    const targetClerkId = clerkUserId || req.user?.clerkUserId;
    const targetEmail = email || req.user?.email;

    console.error(`${DIAG} 3/4. Resolved sync inputs`, {
      targetClerkId: targetClerkId || null,
      targetEmail: targetEmail || null,
      name: name || null,
      hasProfilePic: Boolean(profilePic),
      bodyClerkUserId: clerkUserId || null,
      bodyEmail: email || null,
    });

    if (!targetClerkId) {
      console.error(`${DIAG} FAIL early: clerkUserId missing`);
      return sendError(res, 400, "clerkUserId is required for sync");
    }

    console.error(`${DIAG} Calling provisionOrLinkClerkUser…`);
    const user = await provisionOrLinkClerkUser({
      clerkUserId: targetClerkId,
      email: targetEmail,
      name,
      profilePic,
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
