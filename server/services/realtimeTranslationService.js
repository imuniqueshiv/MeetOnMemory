import RealtimeTranslationCache from "../models/TranslationCache.js";
import UserLanguagePreference from "../models/UserLanguagePreference.js";
import Meeting from "../models/meetingModel.js";

/**
 * Real-time Translation Service
 * Orchestrates translation requests, caching, and quality scoring
 */

// Supported languages
const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "tr", name: "Turkish" },
];

/**
 * Translate text segment with caching and quality scoring
 */
export const translateSegment = async (
  meetingId,
  segmentId,
  sourceText,
  sourceLanguage,
  targetLanguage,
  context = {},
) => {
  try {
    // Check cache first
    const cached = await RealtimeTranslationCache.findCached(
      sourceText,
      sourceLanguage,
      targetLanguage,
    );

    if (cached) {
      console.log(`✓ Cache hit for ${targetLanguage}`);
      return {
        ...cached.toObject(),
        fromCache: true,
      };
    }

    // Apply glossary substitutions
    const processedText = await applyGlossary(
      sourceText,
      sourceLanguage,
      targetLanguage,
      meetingId,
    );

    // Call translation API
    const translation = await callTranslationAPI(
      processedText,
      sourceLanguage,
      targetLanguage,
    );

    // Calculate quality score
    const qualityScore = calculateQualityScore(translation, sourceText);

    // Store in cache
    let cacheEntry = await RealtimeTranslationCache.findOne({
      meeting: meetingId,
      segmentId,
    });
    if (!cacheEntry) {
      cacheEntry = new RealtimeTranslationCache({
        meeting: meetingId,
        segmentId,
        sourceText,
        sourceLanguage,
        context,
        qualityScore,
      });
    }

    await cacheEntry.addTranslation({
      language: targetLanguage,
      text: translation.text,
      confidence: translation.confidence,
      provider: translation.provider,
    });

    console.log(`✓ Translated to ${targetLanguage} (${translation.provider})`);

    return {
      language: targetLanguage,
      text: translation.text,
      confidence: translation.confidence,
      provider: translation.provider,
      qualityScore,
      fromCache: false,
    };
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};

/**
 * Apply glossary substitutions to text
 */
const applyGlossary = async (
  text,
  sourceLanguage,
  targetLanguage,
  meetingId,
) => {
  try {
    // Get meeting to find organization
    const meeting = await Meeting.findById(meetingId);
    if (!meeting || !meeting.organization) return text;

    // Get user preferences for glossary
    const preferences = await UserLanguagePreference.find({
      // In production, filter by organization members
    }).limit(10);

    let processedText = text;

    // Apply glossary substitutions
    for (const pref of preferences) {
      for (const entry of pref.customGlossary) {
        if (entry.language === targetLanguage) {
          const regex = new RegExp(`\\b${escapeRegex(entry.source)}\\b`, "gi");
          processedText = processedText.replace(regex, entry.target);
        }
      }
    }

    return processedText;
  } catch (error) {
    console.error("Glossary application error:", error);
    return text;
  }
};

/**
 * Escape regex special characters
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Call external translation API
 */
const callTranslationAPI = async (text, sourceLanguage, targetLanguage) => {
  try {
    // Try Google Cloud Translation API
    if (process.env.GOOGLE_TRANSLATE_API_KEY) {
      return await translateWithGoogle(text, sourceLanguage, targetLanguage);
    }

    // Try Azure Translator
    if (process.env.AZURE_TRANSLATOR_KEY) {
      return await translateWithAzure(text, sourceLanguage, targetLanguage);
    }

    // Fallback: Return source text with low confidence
    console.warn("⚠️ No translation API configured, returning source text");
    return {
      text,
      confidence: 0.5,
      provider: "fallback",
    };
  } catch (error) {
    console.error("Translation API error:", error);
    // Return source text on error
    return {
      text,
      confidence: 0.3,
      provider: "error",
    };
  }
};

/**
 * Translate using Google Cloud Translation API
 */
const translateWithGoogle = async (text, sourceLanguage, targetLanguage) => {
  const axios = (await import("axios")).default;

  const response = await axios.post(
    `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`,
    {
      q: text,
      source: sourceLanguage,
      target: targetLanguage,
      format: "text",
    },
  );

  const data = response.data.data;

  return {
    text: data.translations[0].translatedText,
    confidence: 0.9, // Google doesn't provide confidence, assume high
    provider: "google",
  };
};

/**
 * Translate using Azure Translator
 */
const translateWithAzure = async (text, sourceLanguage, targetLanguage) => {
  const axios = (await import("axios")).default;

  const response = await axios.post(
    `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${sourceLanguage}&to=${targetLanguage}`,
    [{ text }],
    {
      headers: {
        "Ocp-Apim-Subscription-Key": process.env.AZURE_TRANSLATOR_KEY,
        "Ocp-Apim-Subscription-Region":
          process.env.AZURE_TRANSLATOR_REGION || "global",
        "Content-Type": "application/json",
      },
    },
  );

  const data = response.data[0];

  return {
    text: data.translations[0].text,
    confidence: data.translations[0].to === targetLanguage ? 0.85 : 0.7,
    provider: "azure",
  };
};

/**
 * Calculate quality score for translation
 */
const calculateQualityScore = (translation, sourceText) => {
  let score = 100;

  // Reduce score based on confidence
  score *= translation.confidence;

  // Reduce score if text length differs significantly
  const lengthRatio = translation.text.length / sourceText.length;
  if (lengthRatio < 0.5 || lengthRatio > 2.0) {
    score *= 0.7;
  }

  // Reduce score for fallback provider
  if (translation.provider === "fallback") {
    score *= 0.5;
  }

  // Reduce score for error provider
  if (translation.provider === "error") {
    score *= 0.3;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
};

/**
 * Get user language preferences
 */
export const getUserPreferences = async (userId) => {
  try {
    let preferences = await UserLanguagePreference.findOne({ user: userId });

    if (!preferences) {
      preferences = new UserLanguagePreference({ user: userId });
      await preferences.save();
    }

    return preferences;
  } catch (error) {
    console.error("Error fetching user preferences:", error);
    throw error;
  }
};

/**
 * Update user language preferences
 */
export const updateUserPreferences = async (userId, updates) => {
  try {
    const preferences = await getUserPreferences(userId);

    Object.assign(preferences, updates);
    await preferences.save();

    return preferences;
  } catch (error) {
    console.error("Error updating user preferences:", error);
    throw error;
  }
};

/**
 * Submit manual correction for translation
 */
export const submitCorrection = async (
  meetingId,
  segmentId,
  language,
  correctedText,
  userId,
) => {
  try {
    const cache = await RealtimeTranslationCache.findOne({
      meeting: meetingId,
      segmentId,
    });

    if (!cache) {
      throw new Error("Translation cache entry not found");
    }

    await cache.addTranslation({
      language,
      text: correctedText,
      confidence: 1.0,
      provider: "manual",
      correctedBy: userId,
    });

    console.log(`✓ Manual correction submitted for ${language}`);

    return cache;
  } catch (error) {
    console.error("Error submitting correction:", error);
    throw error;
  }
};

/**
 * Get translation cache for meeting
 */
export const getMeetingTranslations = async (meetingId) => {
  try {
    const translations = await RealtimeTranslationCache.find({
      meeting: meetingId,
    })
      .sort({ "context.timestamp": 1 })
      .limit(1000);

    return translations;
  } catch (error) {
    console.error("Error fetching meeting translations:", error);
    throw error;
  }
};

/**
 * Export multi-language transcript
 */
export const exportTranscript = async (meetingId, format, languages) => {
  try {
    const translations = await RealtimeTranslationCache.find({
      meeting: meetingId,
    }).sort({ "context.timestamp": 1 });

    if (format === "json") {
      return {
        meetingId,
        languages,
        segments: translations.map((t) => ({
          segmentId: t.segmentId,
          timestamp: t.context.timestamp,
          speaker: t.context.speakerName,
          sourceText: t.sourceText,
          sourceLanguage: t.sourceLanguage,
          translations: t.translations
            .filter((tr) => languages.includes(tr.language))
            .map((tr) => ({
              language: tr.language,
              text: tr.text,
              confidence: tr.confidence,
            })),
        })),
      };
    }

    if (format === "srt") {
      // Generate SRT subtitle format
      let srt = "";
      let counter = 1;

      translations.forEach((t) => {
        languages.forEach((lang) => {
          const translation = t.translations.find((tr) => tr.language === lang);
          if (translation) {
            const startTime = formatSRTTime(t.context.timestamp);
            const endTime = formatSRTTime(t.context.timestamp + 5000); // 5 second duration

            srt += `${counter}\n`;
            srt += `${startTime} --> ${endTime}\n`;
            srt += `[${lang.toUpperCase()}] ${translation.text}\n\n`;
            counter++;
          }
        });
      });

      return { content: srt, format: "srt" };
    }

    throw new Error(`Unsupported export format: ${format}`);
  } catch (error) {
    console.error("Error exporting transcript:", error);
    throw error;
  }
};

/**
 * Format time for SRT subtitles
 */
const formatSRTTime = (milliseconds) => {
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const ms = milliseconds % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};

/**
 * Get supported languages
 */
export const getSupportedLanguages = () => {
  return SUPPORTED_LANGUAGES;
};

/**
 * Get translation quality metrics for segment
 */
export const getQualityMetrics = async (segmentId) => {
  try {
    const cache = await RealtimeTranslationCache.findOne({ segmentId });

    if (!cache) {
      throw new Error("Segment not found");
    }

    return {
      segmentId: cache.segmentId,
      sourceLanguage: cache.sourceLanguage,
      qualityScore: cache.qualityScore,
      translationCount: cache.translations.length,
      translations: cache.translations.map((t) => ({
        language: t.language,
        confidence: t.confidence,
        provider: t.provider,
        corrected: !!t.correctedBy,
      })),
      accessCount: cache.accessCount,
      lastAccessedAt: cache.lastAccessedAt,
    };
  } catch (error) {
    console.error("Error fetching quality metrics:", error);
    throw error;
  }
};

export default {
  translateSegment,
  getUserPreferences,
  updateUserPreferences,
  submitCorrection,
  getMeetingTranslations,
  exportTranscript,
  getSupportedLanguages,
  getQualityMetrics,
};
