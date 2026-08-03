import RecapPreference from "../models/recapPreferenceModel.js";
import Meeting from "../models/meetingModel.js";
import RecapEmailService from "../services/recapEmailService.js";

/**
 * Get current user's recap preferences
 */
export const getPreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    let preferences = await RecapPreference.findOne({ userId });

    if (!preferences) {
      // Return default preferences without saving
      preferences = {
        deliveryTiming: "immediate",
        includeTranscript: true,
        includeActionItems: true,
        includeSummary: true,
        timezone: "UTC",
      };
    }

    res.status(200).json(preferences);
  } catch (error) {
    console.error("Error getting recap preferences:", error);
    res.status(500).json({ error: "Failed to get recap preferences." });
  }
};

/**
 * Update current user's recap preferences
 */
export const updatePreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      deliveryTiming,
      includeTranscript,
      includeActionItems,
      includeSummary,
      quietHoursStart,
      quietHoursEnd,
      timezone,
    } = req.body;

    const preferences = await RecapPreference.findOneAndUpdate(
      { userId },
      {
        deliveryTiming,
        includeTranscript,
        includeActionItems,
        includeSummary,
        quietHoursStart,
        quietHoursEnd,
        timezone,
      },
      { new: true, upsert: true },
    );

    res.status(200).json(preferences);
  } catch (error) {
    console.error("Error updating recap preferences:", error);
    res.status(500).json({ error: "Failed to update recap preferences." });
  }
};

/**
 * Generate an HTML preview of the email based on provided preferences
 */
export const previewRecapEmail = async (req, res) => {
  try {
    const preferences = req.body;

    // Find a recent completed meeting to use as preview data,
    // or fallback to a dummy object if none exists.
    let meeting = await Meeting.findOne({ status: "completed" }).sort({
      date: -1,
    });

    // If we need a dummy action item to make the preview look good:
    if (!meeting) {
      meeting = new Meeting({
        _id: "dummy123",
        title: "Project Alpha Kickoff",
        date: new Date(),
        summary:
          "We discussed the roadmap for Project Alpha and agreed on the next steps for Q3.",
        transcript:
          "John: So, we should start the frontend rewrite.\\nJane: I agree, let's use React.\\nJohn: Perfect.",
      });

      // Inject dummy action item if includeActionItems is true
      // Note: RecapEmailService.buildRecapHtml fetches action items from DB by sourceMeetingId.
      // So if meeting._id is dummy, it will return empty. We might have to modify RecapEmailService
      // or just accept that preview uses real DB data if possible.
      // We will create a temp object and override the service logic just for preview by mocking it,
      // but easier is to let it be empty if no real meeting exists.
    }

    const html = await RecapEmailService.buildRecapHtml(meeting, preferences);

    // Return HTML string
    res.status(200).send(html);
  } catch (error) {
    console.error("Error generating recap preview:", error);
    res.status(500).json({ error: "Failed to generate recap preview." });
  }
};
