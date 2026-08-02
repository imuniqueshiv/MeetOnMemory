// server/routes/digestPreferenceRoutes.js

import express from "express";
import {
  getPreferences,
  updatePreferences,
  sendTestDigest,
} from "../controllers/digestPreferenceController.js";
import { protect } from "../middleware/authMiddleware.js";
import { validateDigestPreferences } from "../middleware/validationMiddleware.js";

const router = express.Router();

/**
 * @route   GET /api/digest-preferences
 * @desc    Get current user's digest preferences
 * @access  Private
 */
router.get("/", protect, getPreferences);

/**
 * @route   PUT /api/digest-preferences
 * @desc    Update current user's digest preferences
 * @access  Private
 */
router.put("/", protect, validateDigestPreferences, updatePreferences);

/**
 * @route   POST /api/digest-preferences/test
 * @desc    Send a real test digest email to the current user
 * @access  Private
 */
router.post("/test", protect, sendTestDigest);

export default router;
