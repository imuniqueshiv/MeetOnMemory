import {
  generateSuggestions,
  applyAcceptedSuggestions,
  authorizeAgendaMeeting,
  AgendaSuggestionAuthorizationError,
} from "../services/agendaSuggestionService.js";
import AgendaSuggestion from "../models/agendaSuggestionModel.js";

const handleAuthorizationError = (res, error, fallbackMessage) => {
  if (error instanceof AgendaSuggestionAuthorizationError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({
    message: fallbackMessage,
    error: error.message,
  });
};

// @route   POST /api/agenda-suggestions/generate
// @desc    Generate new agenda suggestions based on organization context
export const generateAgenda = async (req, res) => {
  try {
    const { meetingId, organizationId } = req.body;

    if (!req.user?.organization) {
      return res
        .status(403)
        .json({ message: "Forbidden: Organization membership required" });
    }

    // The client may provide organizationId for compatibility, but it must
    // always match the authenticated user's organization.
    const requestedOrganizationId = organizationId || req.user.organization;
    const suggestion = await generateSuggestions(
      requestedOrganizationId,
      meetingId,
      req.user,
    );
    res.status(201).json(suggestion);
  } catch (error) {
    return handleAuthorizationError(
      res,
      error,
      "Failed to generate agenda suggestions",
    );
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

    await authorizeAgendaMeeting(req.user, suggestionDoc.meeting, "edit");

    if (
      !suggestionDoc.organization ||
      suggestionDoc.organization.toString() !== req.user.organization.toString()
    ) {
      return res.status(403).json({
        message: "Forbidden: Agenda suggestion belongs to another organization",
      });
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
    return handleAuthorizationError(
      res,
      error,
      "Failed to update suggestion item",
    );
  }
};

// @route   POST /api/agenda-suggestions/:id/apply
// @desc    Apply accepted suggestions to the meeting's agenda
export const applyAgenda = async (req, res) => {
  try {
    const { id } = req.params;
    const meeting = await applyAcceptedSuggestions(id, req.user);
    res.status(200).json(meeting);
  } catch (error) {
    return handleAuthorizationError(
      res,
      error,
      "Failed to apply agenda suggestions",
    );
  }
};

// @route   GET /api/agenda-suggestions/meeting/:meetingId
// @desc    Get suggestions for a specific meeting
export const getSuggestionsByMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    await authorizeAgendaMeeting(req.user, meetingId, "view");

    const suggestions = await AgendaSuggestion.find({
      meeting: meetingId,
      organization: req.user.organization,
    }).sort({ createdAt: -1 });
    res.status(200).json(suggestions);
  } catch (error) {
    return handleAuthorizationError(
      res,
      error,
      "Failed to fetch agenda suggestions",
    );
  }
};
