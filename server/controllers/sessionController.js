import { generateSessionCardAI } from "../services/GenerativeAIService.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

// @desc    Generate AI Session Card
// @route   POST /api/sessions/generate
// @access  Private
export const generateSession = async (req, res) => {
  try {
    const { eventName, sessionTitle, speaker, speakerTitle, speakerBio } =
      req.body;

    if (!sessionTitle || sessionTitle.trim() === "") {
      return sendError(res, 400, "Session title is required.");
    }

    const { summary, keywords } = await generateSessionCardAI(
      eventName ? eventName.trim() : "",
      sessionTitle.trim(),
      speaker ? speaker.trim() : "",
      speakerTitle ? speakerTitle.trim() : "",
      speakerBio ? speakerBio.trim() : "",
    );

    return sendSuccess(
      res,
      {
        session: {
          eventName: eventName ? eventName.trim() : "",
          sessionTitle: sessionTitle.trim(),
          speaker: speaker ? speaker.trim() : "",
          speakerTitle: speakerTitle ? speakerTitle.trim() : "",
          summary,
          keywords,
          videoUrl: null,
        },
      },
      "Session card generated successfully.",
    );
  } catch (error) {
    console.error("Error in generateSession controller:", error);
    return sendError(res, 500, "Failed to generate session card.");
  }
};
