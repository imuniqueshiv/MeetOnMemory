import mongoose from "mongoose";

/**
 * UserLanguagePreference Schema
 * Stores user language preferences for translation
 */

const glossaryEntrySchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: true,
    },
    target: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const userLanguagePreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    preferredLanguages: {
      type: [String],
      default: ["en"],
    },
    defaultSourceLanguage: {
      type: String,
      default: "en",
    },
    defaultTargetLanguages: {
      type: [String],
      default: ["en"],
    },
    customGlossary: {
      type: [glossaryEntrySchema],
      default: [],
    },
    autoTranslate: {
      type: Boolean,
      default: true,
    },
    showConfidenceScores: {
      type: Boolean,
      default: true,
    },
    preferredProvider: {
      type: String,
      enum: ["google", "azure", "auto"],
      default: "auto",
    },
    lastUsedLanguages: {
      type: [String],
      default: [],
    },
    meetingLanguageSettings: {
      type: Map,
      of: {
        sourceLanguage: String,
        targetLanguages: [String],
      },
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

// Method to update last used languages
userLanguagePreferenceSchema.methods.updateLastUsed = function (language) {
  this.lastUsedLanguages = [
    language,
    ...this.lastUsedLanguages.filter((l) => l !== language),
  ].slice(0, 5);
  return this.save();
};

// Method to add glossary entry
userLanguagePreferenceSchema.methods.addGlossaryEntry = function (entry) {
  const existing = this.customGlossary.find(
    (e) => e.source === entry.source && e.language === entry.language,
  );
  if (existing) {
    existing.target = entry.target;
  } else {
    this.customGlossary.push(entry);
  }
  return this.save();
};

// Method to remove glossary entry
userLanguagePreferenceSchema.methods.removeGlossaryEntry = function (
  source,
  language,
) {
  this.customGlossary = this.customGlossary.filter(
    (e) => !(e.source === source && e.language === language),
  );
  return this.save();
};

const UserLanguagePreference = mongoose.model(
  "UserLanguagePreference",
  userLanguagePreferenceSchema,
);

export default UserLanguagePreference;
