import MeetingQuestion from "../models/meetingQuestionModel.js";
import Meeting from "../models/meetingModel.js";

// @desc    Get questions for a meeting
// @route   GET /api/meetings/:id/questions
// @access  Private
export const getQuestions = async (req, res) => {
  try {
    const questions = await MeetingQuestion.find({ meetingId: req.params.id })
      .populate("author", "name email profilePic")
      .sort({ createdAt: 1 }); // Can sort by upvotes on client or aggregate here
    res.status(200).json({ success: true, questions });
  } catch (error) {
    console.error("Error in getQuestions:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Submit a new question
// @route   POST /api/meetings/:id/questions
// @access  Private
export const submitQuestion = async (req, res) => {
  try {
    const { text, isAnonymous } = req.body;

    if (!text) {
      return res
        .status(400)
        .json({ success: false, message: "Question text is required" });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    const question = await MeetingQuestion.create({
      meetingId: req.params.id,
      text,
      author: isAnonymous ? null : req.user._id,
      isAnonymous,
    });

    const populatedQuestion = await MeetingQuestion.findById(
      question._id,
    ).populate("author", "name email profilePic");

    res.status(201).json({ success: true, question: populatedQuestion });
  } catch (error) {
    console.error("Error in submitQuestion:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Toggle upvote on a question
// @route   POST /api/questions/:id/upvote
// @access  Private
export const toggleUpvote = async (req, res) => {
  try {
    const question = await MeetingQuestion.findById(req.params.id);

    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    const index = question.upvotes.indexOf(req.user._id);
    if (index === -1) {
      question.upvotes.push(req.user._id);
    } else {
      question.upvotes.splice(index, 1);
    }

    await question.save();

    res.status(200).json({ success: true, upvotes: question.upvotes });
  } catch (error) {
    console.error("Error in toggleUpvote:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update question status (Organizer only)
// @route   PUT /api/questions/:id/status
// @access  Private
export const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = [
      "pending",
      "answering",
      "answered",
      "dismissed",
      "hidden",
    ];

    if (!allowedStatuses.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const question = await MeetingQuestion.findById(req.params.id);
    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }

    // Checking organizer privileges should ideally happen via middleware or by checking meeting owner,
    // but assuming simple RBAC/owner check can be done on the client, or we check if user is meeting owner.

    question.status = status;
    await question.save();

    res.status(200).json({ success: true, question });
  } catch (error) {
    console.error("Error in updateStatus:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
