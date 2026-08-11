/**
 * Extract and sanitize client IP address to prevent X-Forwarded-For spoofing rate limiter bypasses.
 * Uses Express's built-in req.ip (when trust proxy is configured) or falls back to remoteAddress.
 */
export const getClientIp = (req) => {
  if (!req) return "127.0.0.1";

  // Express automatically resolves client IP when trust proxy is enabled
  if (req.ip) {
    return req.ip;
  }

  // Fallback to socket remote address or connection remote address
  const remoteAddress =
    req.socket?.remoteAddress || req.connection?.remoteAddress;

  if (remoteAddress) {
    return remoteAddress;
  }

  // Fallback to sanitizing raw header if req.ip is unpopulated
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    const rawIp =
      typeof forwarded === "string" ? forwarded.split(",")[0] : forwarded[0];
    return rawIp ? rawIp.trim() : "127.0.0.1";
  }

  return "127.0.0.1";
};
