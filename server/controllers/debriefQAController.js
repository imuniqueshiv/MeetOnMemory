import {
  askDebriefQuestion,
  getDebriefSession,
} from "../services/debriefQAService.js";

/**
 * @desc    Ask a debrief question about a specific meeting
 * @route   POST /api/debrief/session
 * @access  Private
 */
export const askQuestion = async (req, res) => {
  try {
    const { meetingId, question } = req.body;
    const userId = req.user._id;

    if (!meetingId || !question) {
      return res
        .status(400)
        .json({ error: "meetingId and question are required" });
    }

    const assistantMessage = await askDebriefQuestion(
      meetingId,
      userId,
      question,
    );
    res.status(200).json(assistantMessage);
  } catch (error) {
    console.error("Error in askQuestion:", error);
    res.status(500).json({ error: "Failed to process question" });
  }
};

/**
 * @desc    Get chat history for a debrief session
 * @route   GET /api/debrief/session/:meetingId
 * @access  Private
 */
export const getSession = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user._id;

    const session = await getDebriefSession(meetingId, userId);
    if (!session) {
      return res.status(200).json({ messages: [] });
    }

    res.status(200).json(session);
  } catch (error) {
    console.error("Error in getSession:", error);
    res.status(500).json({ error: "Failed to fetch session" });
  }
};
