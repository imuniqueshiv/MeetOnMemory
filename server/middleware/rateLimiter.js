import rateLimit from "express-rate-limit";
import { getRedisClient } from "../services/redisService.js";
import { getClientIp } from "../utils/ipUtils.js";

let RedisStore;
try {
  const mod = await import("rate-limit-redis");
  RedisStore = mod.RedisStore || mod.default;
} catch (_e) {
  // rate-limit-redis optional dependency fallback
}

// Create a shared store that uses Redis if available,
// otherwise falls back to in-memory
const createStore = (prefix) => {
  const redisClient = getRedisClient();
  if (redisClient && RedisStore) {
    return new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(...args),
      prefix,
    });
  }
  return undefined; // Falls back to default MemoryStore
};

// Common options to ensure secure IP key generation across all limiters
const baseOptions = {
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable legacy `X-RateLimit-*` headers
  keyGenerator: (req) => getClientIp(req),
};

// General rate limiter for API routes
export const apiLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  store: createStore("rl:api:"),
});

// Stricter rate limiter for write operations (create, update, delete)
export const writeLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 write requests per windowMs
  message: {
    success: false,
    message: "Too many write requests from this IP, please try again later.",
  },
  store: createStore("rl:write:"),
});

// Rate limiter for file uploads (stricter due to resource usage)
export const uploadLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 upload requests per windowMs
  message: {
    success: false,
    message: "Too many upload requests from this IP, please try again later.",
  },
  store: createStore("rl:upload:"),
});

// ================================
// AUTHENTICATION RATE LIMITERS
// ================================

// Rate limiter for login endpoint (protects against brute-force attacks)
export const loginLimiter = rateLimit({
  ...baseOptions,
  // 15 minutes default
  windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS) || 15 * 60 * 1000,
  // 5 attempts per window default
  max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX) || 5,
  message: {
    success: false,
    message: "Too many login attempts, please try again later.",
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  store: createStore("rl:login:"),
});

// Rate limiter for registration endpoint
// (protects against automated account creation)
export const registerLimiter = rateLimit({
  ...baseOptions,
  // 1 hour default
  windowMs:
    parseInt(process.env.RATE_LIMIT_REGISTER_WINDOW_MS) || 60 * 60 * 1000,
  // 3 registrations per hour default
  max: parseInt(process.env.RATE_LIMIT_REGISTER_MAX) || 3,
  message: {
    success: false,
    message: "Too many registration attempts, please try again later.",
  },
  skipSuccessfulRequests: true,
  store: createStore("rl:register:"),
});

// Rate limiter for OTP endpoints (protects against OTP abuse and spam)
export const otpLimiter = rateLimit({
  ...baseOptions,
  // 1 hour default
  windowMs: parseInt(process.env.RATE_LIMIT_OTP_WINDOW_MS) || 60 * 60 * 1000,
  // 5 OTP requests per hour default
  max: parseInt(process.env.RATE_LIMIT_OTP_MAX) || 5,
  message: {
    success: false,
    message: "Too many OTP requests, please try again later.",
  },
  skipSuccessfulRequests: true,
  store: createStore("rl:otp:"),
});

// ================================
// GLOBAL RATE LIMITER
// ================================

// Global limiter: 100 requests per 15 mins per IP
export const globalLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message:
      "Too many requests from this IP, please try again after 15 minutes",
  },
  store: createStore("rl:global:"),
});

// Rate limiter for data export requests (1 per 24 hours per IP)
export const dataExportLimiter = rateLimit({
  ...baseOptions,
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 1, // 1 request per 24 hours
  message: {
    success: false,
    message: "You can only request a data export once every 24 hours.",
  },
  store: createStore("rl:data_export:"),
});

// ================================
// ASSISTANT & POLICY RATE LIMITERS
// ================================

// Rate limiter for RAG assistant message sending
export const assistantMessageLimiter = rateLimit({
  ...baseOptions,
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each user to 10 messages per minute
  message: {
    error: "Too many messages sent. Please try again later.",
  },
  store: createStore("rl:assistant_message:"),
});

// General policy rate limiter (all policy routes)
export const policyApiLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: "Too many requests, please try again after 15 minutes.",
  },
  store: createStore("rl:policy_api:"),
});

// Stricter policy upload rate limiter
export const policyUploadLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: "Too many upload requests, please try again after 15 minutes.",
  },
  store: createStore("rl:policy_upload:"),
});

// Policy re-analysis rate limiter
export const policyAnalyzeLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: {
    success: false,
    message:
      "Too many re-analysis requests, please try again after 15 minutes.",
  },
  store: createStore("rl:policy_analyze:"),
});

// Policy download rate limiter
export const policyDownloadLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  message: {
    success: false,
    message: "Too many download requests, please try again after 15 minutes.",
  },
  store: createStore("rl:policy_download:"),
});

// Policy delete rate limiter
export const policyDeleteLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: "Too many delete requests, please try again after 15 minutes.",
  },
  store: createStore("rl:policy_delete:"),
});

// ================================
// INVITATION RATE LIMITERS
// ================================

/**
 * Resolve the organization id used to scope invitation creation limits.
 * Prefer the target organization from the request body (POST /api/invitations).
 * @param {import("express").Request} req
 * @returns {string|null}
 */
export const resolveInvitationRateLimitOrgId = (req) => {
  const raw =
    req?.body?.organizationId ??
    req?.params?.organizationId ??
    req?.user?.organization ??
    null;
  if (raw == null || raw === "") return null;
  return String(raw);
};

/**
 * Organization-scoped limiter for invitation creation (Issue #1360).
 * Each organization may create at most 10 invitations per hour.
 * Uses Redis via the shared rate-limit store when available; otherwise MemoryStore.
 *
 * @param {object} [overrides] express-rate-limit options (e.g. `{ store }` in tests)
 */
export const createInvitationCreateLimiter = (overrides = {}) =>
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    // Org-scoped (not IP). Skipped when no organization id is present so the
    // controller can still return a normal 400 validation error.
    keyGenerator: (req) => `org:${resolveInvitationRateLimitOrgId(req)}`,
    skip: (req) => !resolveInvitationRateLimitOrgId(req),
    message: {
      success: false,
      message:
        "Invitation rate limit exceeded. Your organization can create up to 10 invitations per hour. Please try again later.",
    },
    store: createStore("rl:invitation_create:"),
    ...overrides,
  });

export const invitationCreateLimiter = createInvitationCreateLimiter();
