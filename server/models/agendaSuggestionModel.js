import mongoose from "mongoose";

const suggestionItemSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  estimatedDuration: {
    type: Number,
    default: 15, // in minutes
  },
  source: {
    type: {
      type: String, // e.g., 'action_item', 'decision', 'thread', 'series_history'
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    title: {
      type: String,
      default: "", // To show the badge text "From: Q2 Review" etc.
    },
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "edited"],
    default: "pending",
  },
  acceptedText: {
    type: String,
    default: "", // If edited or accepted, the final text that goes to the agenda
  },
});

const agendaSuggestionSchema = new mongoose.Schema(
  {
    meeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    suggestions: [suggestionItemSchema],
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    appliedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Indexes
agendaSuggestionSchema.index({ meeting: 1 });
agendaSuggestionSchema.index({ organization: 1 });

const AgendaSuggestion = mongoose.model(
  "AgendaSuggestion",
  agendaSuggestionSchema,
);
export default AgendaSuggestion;
