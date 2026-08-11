import { translateContent } from "../services/translationService.js";
import {
  translateSegment,
  getUserPreferences,
  updateUserPreferences,
  submitCorrection,
  getMeetingTranslations,
  exportTranscript,
  getSupportedLanguages,
  getQualityMetrics,
} from "../services/realtimeTranslationService.js";
import TranslationCache from "../models/translationCacheModel.js";
import Meeting from "../models/meetingModel.js";
import mongoose from "mongoose";

/**
 * Translation Controller
 * Handles HTTP requests for both legacy bulk translation and real-time
 * multi-language synchronized translation endpoints.
 */

// ==========================================
// LEGACY / POST-MEETING TRANSLATION ENDPOINTS
// ==========================================

// @desc    Request a bulk translation (Legacy)
// @route   POST /api/translations/request
// @access  Private
export const requestTranslation = async (req, res) => {
  try {
    const { meetingId, sourceType, targetLanguage } = req.body;

    if (!meetingId || !sourceType || !targetLanguage) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    if (!["transcript", "summary", "action_items"].includes(sourceType)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid sourceType" });
    }

    const translatedContent = await translateContent(
      meetingId,
      sourceType,
      targetLanguage,
    );

    res.status(200).json({ success: true, translatedContent });
  } catch (error) {
    console.error("Error requesting translation:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

// @desc    Clear translation cache for a meeting (Legacy)
// @route   DELETE /api/translations/cache/:meetingId
// @access  Private
export const clearTranslationCache = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid meeting ID" });
    }

    await TranslationCache.deleteMany({ meeting: meetingId });
    res.status(200).json({ success: true, message: "Cache cleared" });
  } catch (error) {
    console.error("Error clearing translation cache:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ==========================================
// REAL-TIME TRANSLATION ENDPOINTS
// ==========================================

/**
 * @desc Translate text segment in real-time
 * @route POST /api/translation/translate
 * @access Private
 */
export const translate = async (req, res) => {
  try {
    const {
      meetingId,
      segmentId,
      sourceText,
      sourceLanguage,
      targetLanguage,
      context,
    } = req.body;

    if (
      !meetingId ||
      !segmentId ||
      !sourceText ||
      !sourceLanguage ||
      !targetLanguage
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    // Check meeting access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (meeting.organization.toString() !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const translation = await translateSegment(
      meetingId,
      segmentId,
      sourceText,
      sourceLanguage,
      targetLanguage,
      context,
    );

    res.status(200).json(translation);
  } catch (error) {
    console.error("Error translating:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get supported languages
 * @route GET /api/translation/languages
 * @access Private
 */
export const getLanguages = async (req, res) => {
  try {
    const languages = getSupportedLanguages();
    res.status(200).json({ languages });
  } catch (error) {
    console.error("Error fetching languages:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get user language preferences
 * @route GET /api/translation/preferences
 * @access Private
 */
export const getPreferences = async (req, res) => {
  try {
    const preferences = await getUserPreferences(req.user._id);
    res.status(200).json(preferences);
  } catch (error) {
    console.error("Error fetching preferences:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Update user language preferences
 * @route PUT /api/translation/preferences
 * @access Private
 */
export const updatePreferences = async (req, res) => {
  try {
    const updates = req.body;
    const preferences = await updateUserPreferences(req.user._id, updates);
    res.status(200).json(preferences);
  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Submit manual correction
 * @route POST /api/translation/correct
 * @access Private
 */
export const correct = async (req, res) => {
  try {
    const { meetingId, segmentId, language, correctedText } = req.body;

    if (!meetingId || !segmentId || !language || !correctedText) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    // Check meeting access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (meeting.organization.toString() !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const result = await submitCorrection(
      meetingId,
      segmentId,
      language,
      correctedText,
      req.user._id,
    );

    res.status(200).json({ message: "Correction submitted", result });
  } catch (error) {
    console.error("Error submitting correction:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get translation cache for meeting
 * @route GET /api/translation/cache/:meetingId
 * @access Private
 */
export const getCache = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    // Check meeting access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (meeting.organization.toString() !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const translations = await getMeetingTranslations(meetingId);
    res.status(200).json({ translations });
  } catch (error) {
    console.error("Error fetching cache:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Export transcripts
 * @route POST /api/translation/export/:meetingId
 * @access Private
 */
export const exportTranscripts = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { format = "json", languages = ["en"] } = req.body;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    // Check meeting access
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (meeting.organization.toString() !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const exportData = await exportTranscript(meetingId, format, languages);

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=transcript-${meetingId}.json`,
      );
      res.status(200).json(exportData);
    } else if (format === "srt") {
      res.setHeader("Content-Type", "text/plain");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=transcript-${meetingId}.srt`,
      );
      res.status(200).send(exportData.content);
    } else {
      res.status(400).json({ message: "Invalid format. Use 'json' or 'srt'" });
    }
  } catch (error) {
    console.error("Error exporting transcripts:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get quality metrics for segment
 * @route GET /api/translation/quality/:segmentId
 * @access Private
 */
export const getQuality = async (req, res) => {
  try {
    const { segmentId } = req.params;

    const metrics = await getQualityMetrics(segmentId);
    res.status(200).json(metrics);
  } catch (error) {
    console.error("Error fetching quality metrics:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
