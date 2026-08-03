import {
  generateSuggestions,
  applyAcceptedSuggestions,
} from "../services/agendaSuggestionService.js";
import AgendaSuggestion from "../models/agendaSuggestionModel.js";

// @route   POST /api/agenda-suggestions/generate
// @desc    Generate new agenda suggestions based on organization context
export const generateAgenda = async (req, res) => {
  try {
    const meetingId = req.body.meetingId;
    const organizationId = req.body.organizationId || req.user?.organization;

    if (!organizationId) {
      return res.status(400).json({ message: "organizationId is required" });
    }

    const suggestion = await generateSuggestions(organizationId, meetingId);
    res.status(201).json(suggestion);
  } catch (error) {
    console.error("Error generating agenda suggestions:", error);
    res.status(500).json({
      message: "Failed to generate agenda suggestions",
      error: error.message,
    });
  }
};

// @route   PUT /api/agenda-suggestions/:id/item/:itemId
// @desc    Update a specific suggestion item (accept, reject, edit)
export const updateSuggestionItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { status, acceptedText } = req.body;

    const suggestionDoc = await AgendaSuggestion.findById(id);
    if (!suggestionDoc) {
      return res.status(404).json({ message: "Agenda suggestion not found" });
    }

    const item = suggestionDoc.suggestions.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Suggestion item not found" });
    }

    if (status) item.status = status;
    if (acceptedText !== undefined) item.acceptedText = acceptedText;

    await suggestionDoc.save();
    res.status(200).json(suggestionDoc);
  } catch (error) {
    console.error("Error updating suggestion item:", error);
    res.status(500).json({
      message: "Failed to update suggestion item",
      error: error.message,
    });
  }
};

// @route   POST /api/agenda-suggestions/:id/apply
// @desc    Apply accepted suggestions to the meeting's agenda
export const applyAgenda = async (req, res) => {
  try {
    const { id } = req.params;
    const meeting = await applyAcceptedSuggestions(id);
    res.status(200).json(meeting);
  } catch (error) {
    console.error("Error applying agenda suggestions:", error);
    res.status(500).json({
      message: "Failed to apply agenda suggestions",
      error: error.message,
    });
  }
};

// @route   GET /api/agenda-suggestions/meeting/:meetingId
// @desc    Get suggestions for a specific meeting
export const getSuggestionsByMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const suggestions = await AgendaSuggestion.find({
      meeting: meetingId,
    }).sort({ createdAt: -1 });
    res.status(200).json(suggestions);
  } catch (error) {
    console.error("Error fetching agenda suggestions:", error);
    res.status(500).json({
      message: "Failed to fetch agenda suggestions",
      error: error.message,
    });
  }
};
