import rateLimit from "express-rate-limit";
import { getRedisClient } from "../services/redisService.js";

let RedisStore;
try {
  const mod = await import("rate-limit-redis");
  RedisStore = mod.RedisStore || mod.default;
} catch (_e) {
  // rate-limit-redis optional dependency fallback
}

// Create a shared store that uses Redis if available, otherwise falls back to in-memory
const createStore = () => {
  const redisClient = getRedisClient();
  if (redisClient && RedisStore) {
    return new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(...args),
    });
  }
  return undefined; // Falls back to default MemoryStore
};

// General rate limiter for API routes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  store: createStore(),
});

// Stricter rate limiter for write operations (create, update, delete)
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 write requests per windowMs
  message: {
    success: false,
    message: "Too many write requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
});

// Rate limiter for file uploads (stricter due to resource usage)
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 upload requests per windowMs
  message: {
    success: false,
    message: "Too many upload requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
});

// ================================
// AUTHENTICATION RATE LIMITERS
// ================================

// Rate limiter for login endpoint (protects against brute-force attacks)
export const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX) || 5, // 5 attempts per window default
  message: {
    success: false,
    message: "Too many login attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  store: createStore(),
});

// Rate limiter for registration endpoint (protects against automated account creation)
export const registerLimiter = rateLimit({
  windowMs:
    parseInt(process.env.RATE_LIMIT_REGISTER_WINDOW_MS) || 60 * 60 * 1000, // 1 hour default
  max: parseInt(process.env.RATE_LIMIT_REGISTER_MAX) || 3, // 3 registrations per hour default
  message: {
    success: false,
    message: "Too many registration attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: createStore(),
});

// Rate limiter for OTP endpoints (protects against OTP abuse and spam)
export const otpLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_OTP_WINDOW_MS) || 60 * 60 * 1000, // 1 hour default
  max: parseInt(process.env.RATE_LIMIT_OTP_MAX) || 5, // 5 OTP requests per hour default
  message: {
    success: false,
    message: "Too many OTP requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: createStore(),
});

// ================================
// GLOBAL RATE LIMITER
// ================================

// Global limiter: 100 requests per 15 mins per IP
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message:
      "Too many requests from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
});

// Rate limiter for data export requests (1 per 24 hours per IP)
export const dataExportLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 1, // 1 request per 24 hours
  message: {
    success: false,
    message: "You can only request a data export once every 24 hours.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
});
