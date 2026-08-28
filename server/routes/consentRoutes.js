/**
 * Consent Routes — Issue #2247
 *
 * API endpoints for recording consent management:
 *   POST /api/consent/record       — Record uploader/organizer consent
 *   POST /api/consent/participant  — Record participant consent (live room)
 *   POST /api/consent/revoke       — Revoke previously granted consent
 *   GET  /api/consent/check        — Check consent status for a meeting
 *   GET  /api/consent/audit        — Get consent audit trail (compliance)
 */

import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  apiLimiter,
  writeLimiter,
} from "../middleware/rateLimiter.js";
import {
  recordConsent,
  recordParticipantConsent,
  revokeConsent,
  checkConsent,
  getConsentAuditTrail,
} from "../controllers/consentController.js";

const router = express.Router();

// All consent routes require authentication
router.use(userAuth);

// Rate limit write endpoints
router.post("/record", apiLimiter, writeLimiter, recordConsent);
router.post("/participant", apiLimiter, writeLimiter, recordParticipantConsent);
router.post("/revoke", apiLimiter, writeLimiter, revokeConsent);

// Read endpoints — lighter rate limit
router.get("/check", apiLimiter, checkConsent);
router.get("/audit", apiLimiter, getConsentAuditTrail);

export default router;
