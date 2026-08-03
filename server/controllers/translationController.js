import {
  getSupportedLanguages,
  translateContent,
} from "../services/translationService.js";
import TranslationCache from "../models/translationCacheModel.js";

// @desc    Get supported translation languages
// @route   GET /api/translations/languages
// @access  Private
export const getLanguages = async (req, res) => {
  try {
    const languages = getSupportedLanguages();
    res.status(200).json({ success: true, languages });
  } catch (error) {
    console.error("Error fetching languages:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Request a translation
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

// @desc    Clear translation cache for a meeting
// @route   DELETE /api/translations/cache/:meetingId
// @access  Private
export const clearTranslationCache = async (req, res) => {
  try {
    const { meetingId } = req.params;
    await TranslationCache.deleteMany({ meeting: meetingId });
    res.status(200).json({ success: true, message: "Cache cleared" });
  } catch (error) {
    console.error("Error clearing translation cache:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
