import mongoose from "mongoose";

/**
 * RealtimeTranslationCache Schema
 * Stores translation memory to reduce API costs and improve consistency
 */

const translationSchema = new mongoose.Schema({
  language: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.85,
  },
  provider: {
    type: String,
    enum: ["google", "azure", "manual", "cache"],
    default: "google",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  correctedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

const translationCacheSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    segmentId: {
      type: String,
      required: true,
      index: true,
    },
    sourceText: {
      type: String,
      required: true,
    },
    sourceLanguage: {
      type: String,
      required: true,
    },
    translations: {
      type: [translationSchema],
      default: [],
    },
    context: {
      meetingTitle: String,
      speaker: String,
      speakerName: String,
      topic: String,
      timestamp: Number,
    },
    qualityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for efficient lookups
translationCacheSchema.index({ meeting: 1, segmentId: 1 }, { unique: true });
translationCacheSchema.index({ sourceText: 1, sourceLanguage: 1 });
translationCacheSchema.index({ accessCount: -1 });

// TTL index to clean old translations (keep for 1 year)
translationCacheSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 },
);

// Method to add translation
translationCacheSchema.methods.addTranslation = function (translation) {
  const existing = this.translations.find(
    (t) => t.language === translation.language,
  );
  if (existing) {
    existing.text = translation.text;
    existing.confidence = translation.confidence;
    existing.provider = translation.provider;
    existing.timestamp = new Date();
    if (translation.correctedBy) {
      existing.correctedBy = translation.correctedBy;
    }
  } else {
    this.translations.push(translation);
  }
  this.accessCount += 1;
  this.lastAccessedAt = new Date();
  return this.save();
};

// Method to get translation for specific language
translationCacheSchema.methods.getTranslation = function (language) {
  this.accessCount += 1;
  this.lastAccessedAt = new Date();
  return this.translations.find((t) => t.language === language);
};

// Static method to find cached translation
translationCacheSchema.statics.findCached = function (
  sourceText,
  sourceLanguage,
  targetLanguage,
) {
  return this.findOne({
    sourceText,
    sourceLanguage,
    "translations.language": targetLanguage,
  }).then((doc) => {
    if (doc) {
      doc.accessCount += 1;
      doc.lastAccessedAt = new Date();
      return doc.save().then((saved) => {
        return saved.translations.find((t) => t.language === targetLanguage);
      });
    }
    return null;
  });
};

// FIX: Renamed to RealtimeTranslationCache to avoid OverwriteModelError with legacy translationCacheModel.js
const RealtimeTranslationCache = mongoose.model(
  "RealtimeTranslationCache",
  translationCacheSchema,
);

export default RealtimeTranslationCache;
