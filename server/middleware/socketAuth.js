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
    // Check if this connection (across multiplexed namespaces)
    // has already been authenticated
    const sharedUser = socket.request?.user || socket.client?.user;
    if (sharedUser) {
      socket.user = sharedUser;
      socket.userId = socket.request?.userId || socket.client?.userId;
      socket.userRole = socket.request?.userRole || socket.client?.userRole;
      socket.userOrganization =
        socket.request?.userOrganization || socket.client?.userOrganization;
      return next();
    }

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

    // Cache the authenticated context on the underlying connection
    // (HTTP request & client) to share it across multiplexed namespaces
    // (e.g. /sync) on the same connection.
    if (socket.request) {
      socket.request.user = user;
      socket.request.userId = socket.userId;
      socket.request.userRole = socket.userRole;
      socket.request.userOrganization = socket.userOrganization;
    }
    if (socket.client) {
      socket.client.user = user;
      socket.client.userId = socket.userId;
      socket.client.userRole = socket.userRole;
      socket.client.userOrganization = socket.userOrganization;
    }

    next();
  } catch (error) {
    console.error("Socket authentication error:", error.message);
    return next(new Error("Authentication error"));
  }
};

export default authenticateSocket;
