import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  translate,
  getLanguages,
  getPreferences,
  updatePreferences,
  correct,
  getCache,
  exportTranscripts,
  getQuality,
  requestTranslation,
  clearTranslationCache,
} from "../controllers/translationController.js";

const router = express.Router();

// Apply authentication to all routes
router.use(userAuth);

// ==========================================
// REAL-TIME TRANSLATION ROUTES
// ==========================================

// Translation operations
router.post("/translate", translate);
router.post("/correct", correct);

// Languages and preferences
router.get("/languages", getLanguages);
router.get("/preferences", getPreferences);
router.put("/preferences", updatePreferences);

// Cache, export, and quality metrics
router.get("/cache/:meetingId", getCache);
router.post("/export/:meetingId", exportTranscripts);
router.get("/quality/:segmentId", getQuality);

// ==========================================
// LEGACY / BULK TRANSLATION ROUTES
// ==========================================

// Bulk translation request (Legacy)
router.post("/request", requestTranslation);

// Clear translation cache (Legacy)
router.delete("/cache/:meetingId", clearTranslationCache);

export default router;
