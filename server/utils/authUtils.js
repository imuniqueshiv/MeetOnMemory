/**
 * Authentication provider helpers.
 * MeetOnMemory is Clerk-only for user identity. MongoDB remains authorization SoT.
 */

/**
 * @returns {"clerk"}
 */
export const getAuthProviderFlag = () => {
  const raw = (process.env.AUTH_PROVIDER || "clerk").toLowerCase();
  if (raw !== "clerk") {
    // Dual/legacy modes are retired — always run Clerk-only identity.
    return "clerk";
  }
  return "clerk";
};

/**
 * Normalize verified Clerk JWT claims into a stable identity object.
 * Used for provisioning / sync — never derive these fields from req.body.
 *
 * @param {object|null|undefined} claims - Decoded Clerk session token
 * @returns {{ clerkUserId: string, email: string|null, name: string|null, profilePic: string|null }|null}
 */
export function extractClerkIdentityFromClaims(claims) {
  if (!claims?.sub || typeof claims.sub !== "string") {
    return null;
  }

  const email =
    claims.email ||
    claims.email_address ||
    claims.primary_email_address ||
    null;

  const name =
    claims.name ||
    (claims.first_name
      ? `${claims.first_name} ${claims.last_name || ""}`.trim()
      : null);

  const profilePic = claims.picture || claims.image_url || null;

  return {
    clerkUserId: claims.sub,
    email: email || null,
    name: name || null,
    profilePic: profilePic || null,
  };
}

/**
 * Resolve Clerk session claims from a Bearer token.
 * In tests, JWTs signed with JWT_SECRET that include `sub` act as Clerk stand-ins
 * (not legacy session auth — see CLERK_TEST_AUTH).
 */
export async function verifyClerkSessionToken(token) {
  if (!token) {
    throw new Error("Missing authentication token");
  }

  if (
    process.env.NODE_ENV === "test" &&
    process.env.CLERK_TEST_AUTH === "jwt"
  ) {
    const jwt = await import("jsonwebtoken");
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
    if (!decoded?.sub) {
      throw new Error("Test Clerk token must include sub");
    }
    return decoded;
  }

  const { verifyToken } = await import("@clerk/express");
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is not configured");
  }
  return verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY,
  });
}

/**
 * Check if a user and a resource belong to the same organization.
 * @param {object} user - User object containing `organization`.
 * @param {object} resource - Resource object containing `organization`.
 * @returns {boolean} True if both have valid, matching organization IDs.
 */
export const isSameOrganization = (user, resource) => {
  const userOrg = user?.organization?.toString();
  const resourceOrg = resource?.organization?.toString();
  return Boolean(userOrg && resourceOrg && userOrg === resourceOrg);
};
