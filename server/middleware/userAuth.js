import {
  findUserByClerkId,
  provisionOrLinkClerkUser,
} from "../services/authLinkingService.js";
import { verifyClerkSessionToken } from "../utils/authUtils.js";
import logger from "../utils/logger.js";

const DIAG = "[SYNC-CLERK-DIAG]";

/**
 * Build a log-safe snapshot of an auth request.
 * Never includes cookies, Authorization headers, tokens, or other credentials.
 */
export function sanitizeAuthRequestForLog(req = {}) {
  const headers = req.headers || {};
  const authorization =
    typeof req.header === "function"
      ? req.header("Authorization")
      : headers.authorization || headers.Authorization;

  return {
    method: req.method || undefined,
    url: req.originalUrl || req.url || undefined,
    ip: req.ip || headers["x-forwarded-for"] || undefined,
    origin: headers.origin || undefined,
    hasAuthorizationHeader: Boolean(authorization),
  };
}

const isVerboseAuthLoggingEnabled = () => process.env.NODE_ENV !== "production";

const extractBearerToken = (req) => {
  const header =
    typeof req.header === "function"
      ? req.header("Authorization")
      : req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

/**
 * Clerk-only HTTP authentication.
 * Resolves MongoDB `req.user` via authLinkingService (RBAC source of truth).
 */
const userAuth = async (req, res, next) => {
  const safeRequest = sanitizeAuthRequestForLog(req);
  const isSyncRoute =
    typeof (req.originalUrl || req.url) === "string" &&
    (req.originalUrl || req.url).includes("/sync-clerk-user");

  try {
    if (isVerboseAuthLoggingEnabled() || isSyncRoute) {
      logger.info("Auth middleware request", safeRequest);
    }

    if (isSyncRoute) {
      console.error(`${DIAG} userAuth ENTER (sync-clerk-user)`, safeRequest);
    }

    const token = extractBearerToken(req);
    if (!token) {
      if (isSyncRoute) {
        console.error(`${DIAG} userAuth FAIL: no Bearer token`);
      }
      return res.status(401).json({
        success: false,
        message: "No token found. Please login first.",
      });
    }

    let decodedClerk;
    try {
      decodedClerk = await verifyClerkSessionToken(token);
      if (isSyncRoute) {
        console.error(`${DIAG} 2. Clerk token verified`, {
          sub: decodedClerk?.sub || null,
          email:
            decodedClerk?.email ||
            decodedClerk?.email_address ||
            decodedClerk?.primary_email_address ||
            null,
          claimKeys: decodedClerk ? Object.keys(decodedClerk) : [],
        });
      }
    } catch (verifyErr) {
      if (isSyncRoute) {
        console.error(`${DIAG} 2. Clerk token verification FAILED`);
        console.error(verifyErr);
        console.error(verifyErr?.stack);
      }
      return res.status(401).json({
        success: false,
        message: "Invalid Clerk token.",
      });
    }

    if (!decodedClerk?.sub) {
      if (isSyncRoute) {
        console.error(`${DIAG} 2. Clerk token missing sub claim`);
      }
      return res.status(401).json({
        success: false,
        message: "Invalid Clerk token.",
      });
    }

    if (isSyncRoute) {
      console.error(`${DIAG} 3. Clerk user id (sub)`, {
        sub: decodedClerk.sub,
      });
      console.error(`${DIAG} 4. Clerk email from JWT claims`, {
        email: decodedClerk.email || null,
        email_address: decodedClerk.email_address || null,
        primary_email_address: decodedClerk.primary_email_address || null,
      });
      console.error(`${DIAG} 5. Existing Mongo user lookup by clerkUserId…`);
    }

    let user = await findUserByClerkId(decodedClerk.sub);
    if (isSyncRoute) {
      console.error(`${DIAG} 5. Mongo lookup by clerkUserId result`, {
        found: Boolean(user),
        mongoUserId: user?._id?.toString?.() || null,
        email: user?.email || null,
      });
    }

    if (!user) {
      if (isSyncRoute) {
        console.error(
          `${DIAG} userAuth: no Mongo user — calling provisionOrLinkClerkUser`,
        );
      }
      try {
        user = await provisionOrLinkClerkUser({
          clerkUserId: decodedClerk.sub,
          email:
            decodedClerk.email ||
            decodedClerk.email_address ||
            decodedClerk.primary_email_address,
          name:
            decodedClerk.name ||
            (decodedClerk.first_name
              ? `${decodedClerk.first_name} ${decodedClerk.last_name || ""}`.trim()
              : null),
          profilePic: decodedClerk.picture || decodedClerk.image_url,
        });
      } catch (provisionErr) {
        // Surface the real exception — previously this became a generic 401
        console.error(`${DIAG} userAuth provisionOrLinkClerkUser THREW`);
        console.error(provisionErr);
        console.error(provisionErr?.stack);
        throw provisionErr;
      }
    }

    if (!user) {
      if (isSyncRoute) {
        console.error(`${DIAG} userAuth FAIL: provision returned null`);
      }
      return res.status(401).json({
        success: false,
        message: "Authentication failed. Invalid token.",
      });
    }

    req.user = user;

    if (isVerboseAuthLoggingEnabled() || isSyncRoute) {
      logger.info("Auth middleware success", {
        ...safeRequest,
        userId: user._id?.toString?.() || user.id || undefined,
      });
    }

    if (isSyncRoute) {
      console.error(`${DIAG} userAuth SUCCESS → next(syncClerkUser)`, {
        mongoUserId: user._id?.toString?.() || null,
        clerkUserId: user.clerkUserId || null,
        email: user.email || null,
      });
    }

    next();
  } catch (error) {
    console.error(`${DIAG} userAuth OUTER catch`);
    console.error(error);
    console.error(error?.stack);
    logger.error("Auth middleware error", error, safeRequest);
    return res.status(401).json({
      success: false,
      message: "Unauthorized or token expired.",
    });
  }
};

export default userAuth;
