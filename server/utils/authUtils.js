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
