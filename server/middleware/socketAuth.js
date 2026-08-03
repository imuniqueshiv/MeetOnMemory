import {
  findUserByClerkId,
  provisionOrLinkClerkUser,
} from "../services/authLinkingService.js";
import { verifyClerkSessionToken } from "../utils/authUtils.js";

/**
 * Socket.IO authentication — Clerk session tokens only.
 * Prefer handshake.auth.token or Authorization Bearer.
 * Resolves MongoDB user via authLinkingService and attaches RBAC fields.
 */
export const authenticateSocket = async (socket, next) => {
  try {
    const authHeader = socket.handshake?.headers?.authorization;
    const authObjectToken = socket.handshake?.auth?.token;

    const token =
      authObjectToken ||
      (authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : null);

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    let decodedClerk;
    try {
      decodedClerk = await verifyClerkSessionToken(token);
    } catch (_err) {
      return next(new Error("Authentication error: Invalid Clerk token"));
    }

    if (!decodedClerk?.sub) {
      return next(new Error("Authentication error: Invalid Clerk token"));
    }

    let user = await findUserByClerkId(decodedClerk.sub);
    if (!user) {
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
    }

    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    socket.user = user;
    socket.userId = user._id ? user._id.toString() : user.id;
    socket.userRole = user.role;
    socket.userOrganization = user.organization;

    next();
  } catch (error) {
    console.error("Socket authentication error:", error.message);
    return next(new Error("Authentication error"));
  }
};

export default authenticateSocket;
