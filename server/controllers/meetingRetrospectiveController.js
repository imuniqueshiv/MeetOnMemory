import MeetingRetrospective from "../models/meetingRetrospectiveModel.js";
import Meeting from "../models/meetingModel.js";
import {
  generateText,
  parseJsonOutput,
} from "../services/GenerativeAIService.js";

// @desc    Get retrospective for a meeting
// @route   GET /api/meeting-retrospectives/:meetingId
// @access  Private
export const getRetrospective = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const retrospective = await MeetingRetrospective.findOne({ meetingId })
      .populate("submissions.userId", "name email profilePicture")
      .populate("submissions.wentWellUpvotes", "name email")
      .populate("submissions.couldImproveUpvotes", "name email");

    if (!retrospective) {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    res.status(200).json({
      success: true,
      data: retrospective,
    });
  } catch (error) {
    console.error("Error fetching retrospective:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Submit or update a retrospective submission
// @route   POST /api/meeting-retrospectives/:meetingId/submissions
// @access  Private
export const submitRetrospective = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { isAnonymous, wentWell, couldImprove, actionSuggestions } = req.body;
    const userId = req.user._id;

    let retrospective = await MeetingRetrospective.findOne({ meetingId });

    if (!retrospective) {
      const meeting = await Meeting.findById(meetingId);
      if (!meeting) {
        return res
          .status(404)
          .json({ success: false, message: "Meeting not found" });
      }

      retrospective = new MeetingRetrospective({
        meetingId,
        organization: meeting.organization,
        submissions: [],
      });
    }

    const existingSubmissionIndex = retrospective.submissions.findIndex(
      (sub) => sub.userId.toString() === userId.toString(),
    );

    if (existingSubmissionIndex !== -1) {
      // Update existing submission
      retrospective.submissions[existingSubmissionIndex].isAnonymous =
        isAnonymous;
      retrospective.submissions[existingSubmissionIndex].wentWell = wentWell;
      retrospective.submissions[existingSubmissionIndex].couldImprove =
        couldImprove;
      retrospective.submissions[existingSubmissionIndex].actionSuggestions =
        actionSuggestions;
    } else {
      // Create new submission
      retrospective.submissions.push({
        userId,
        isAnonymous,
        wentWell,
        couldImprove,
        actionSuggestions,
      });
    }

    await retrospective.save();

    // Repopulate user info for returning
    await retrospective.populate(
      "submissions.userId",
      "name email profilePicture",
    );

    res.status(200).json({
      success: true,
      data: retrospective,
      message: "Retrospective submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting retrospective:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Upvote a submission item
// @route   POST /api/meeting-retrospectives/:meetingId/submissions/:submissionId/upvote
// @access  Private
export const upvoteItem = async (req, res) => {
  try {
    const { meetingId, submissionId } = req.params;
    const { type } = req.body; // 'wentWell' or 'couldImprove'
    const userId = req.user._id;

    if (!["wentWell", "couldImprove"].includes(type)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid upvote type" });
    }

    const retrospective = await MeetingRetrospective.findOne({ meetingId });
    if (!retrospective) {
      return res
        .status(404)
        .json({ success: false, message: "Retrospective not found" });
    }

    const submission = retrospective.submissions.id(submissionId);
    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    const upvoteArray =
      type === "wentWell"
        ? submission.wentWellUpvotes
        : submission.couldImproveUpvotes;
    const hasUpvoted = upvoteArray.includes(userId);

    if (hasUpvoted) {
      // Remove upvote
      upvoteArray.pull(userId);
    } else {
      // Add upvote
      upvoteArray.push(userId);
    }

    await retrospective.save();

    await retrospective.populate(
      "submissions.userId",
      "name email profilePicture",
    );
    await retrospective.populate("submissions.wentWellUpvotes", "name email");
    await retrospective.populate(
      "submissions.couldImproveUpvotes",
      "name email",
    );

    res.status(200).json({
      success: true,
      data: retrospective,
      message: hasUpvoted ? "Upvote removed" : "Upvoted successfully",
    });
  } catch (error) {
    console.error("Error upvoting:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Generate AI themes from all submissions
// @route   POST /api/meeting-retrospectives/:meetingId/ai-themes
// @access  Private
export const generateAiThemes = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const retrospective = await MeetingRetrospective.findOne({ meetingId });
    if (!retrospective || retrospective.submissions.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No submissions to analyze" });
    }

    // Compile submissions into a prompt
    const feedbackList = retrospective.submissions
      .map((sub, index) => {
        return `Submission ${index + 1}:
- Went Well: ${sub.wentWell || "N/A"}
- Could Improve: ${sub.couldImprove || "N/A"}
- Action Suggestions: ${sub.actionSuggestions || "N/A"}
`;
      })
      .join("\\n");

    const prompt = `
You are an AI assistant analyzing a team retrospective for a meeting.
Here are the submissions from participants:

${feedbackList}

Identify 2-4 overarching themes from the "Went Well" feedback and 2-4 themes from the "Could Improve" feedback.
Format your output as a professional summary. Be concise.

Return ONLY a valid JSON object matching this structure (no markdown formatting, no commentary):
{
  "themes": "A comprehensive summary of the themes identified (2-3 paragraphs max)."
}
`;

    const outputText = await generateText(
      prompt,
      "Gemini retrospective themes",
    );
    const parsed = parseJsonOutput(outputText);

    if (!parsed || !parsed.themes) {
      throw new Error(
        "Failed to parse Gemini JSON output for retrospective themes",
      );
    }

    retrospective.aiThemes = parsed.themes;
    await retrospective.save();

    await retrospective.populate(
      "submissions.userId",
      "name email profilePicture",
    );
    await retrospective.populate("submissions.wentWellUpvotes", "name email");
    await retrospective.populate(
      "submissions.couldImproveUpvotes",
      "name email",
    );

    res.status(200).json({
      success: true,
      data: retrospective,
      message: "AI themes generated successfully",
    });
  } catch (error) {
    console.error("Error generating AI themes:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
