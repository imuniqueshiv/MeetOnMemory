import mongoose from "mongoose";

const translationCacheSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      enum: ["transcript", "summary", "action_items"],
      required: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "sourceModel",
    },
    sourceModel: {
      type: String,
      required: true,
      enum: ["Transcript", "Meeting"],
    },
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      index: true,
    },
    targetLanguage: {
      type: String,
      required: true,
    },
    translatedContent: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    tokenCount: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      index: { expires: 0 }, // Document expires exactly at expiresAt
    },
  },
  { timestamps: true },
);

// Compound index for quick lookup
translationCacheSchema.index(
  { sourceId: 1, sourceType: 1, targetLanguage: 1 },
  { unique: true },
);

const TranslationCache = mongoose.model(
  "TranslationCache",
  translationCacheSchema,
);

export default TranslationCache;
