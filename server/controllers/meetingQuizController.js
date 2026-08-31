import mongoose from "mongoose";
import MeetingQuiz from "../models/meetingQuizModel.js";
import QuizResponse from "../models/quizResponseModel.js";
import Meeting from "../models/meetingModel.js";
import GamificationScore from "../models/gamificationScoreModel.js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy-key-for-tests",
});

/**
 * Deterministic fallback quiz generator when AI is disabled/errors.
 */
const generateStaticFallbackQuiz = (meeting) => {
  const questions = [
    {
      questionText: `What was the main topic/title of the meeting?`,
      options: [
        meeting.title,
        `Retrospective on ${meeting.title}`,
        `SLA review regarding ${meeting.title}`,
        `Planning session for next quarter`,
      ],
      correctOptionIndex: 0,
      explanation: `The title of the meeting was "${meeting.title}".`,
    },
  ];

  if (meeting.summary) {
    questions.push({
      questionText: `Which of the following aligns with the summary discussed in the meeting?`,
      options: [
        meeting.summary.substring(0, 80) + "...",
        "No major updates were reported.",
        "The meeting was rescheduled.",
        "Discussion was postponed indefinitely.",
      ],
      correctOptionIndex: 0,
      explanation: `The summary states: "${meeting.summary.substring(0, 150)}..."`,
    });
  } else {
    questions.push({
      questionText: `What was the purpose/description of this meeting?`,
      options: [
        meeting.description || "Project discussion",
        "Introducing new team members",
        "A regular budget check-in",
        "Discussing marketing campaign details",
      ],
      correctOptionIndex: 0,
      explanation: `The description of the meeting was "${meeting.description || "Project discussion"}".`,
    });
  }

  return {
    meetingId: meeting._id,
    questions,
  };
};

/**
 * Award gamification points to the user for passing the quiz.
 */
const awardQuizPoints = async (userId, orgId, meetingId, scorePercentage) => {
  if (scorePercentage < 70) return; // Only award points if they pass (70% or more)

  const points = Math.round(scorePercentage);
  try {
    let userScore = await GamificationScore.findOne({
      user: userId,
      organization: orgId,
    });
    if (!userScore) {
      userScore = new GamificationScore({
        user: userId,
        organization: orgId,
        totalPoints: 0,
        history: [],
      });
    }

    // Check if points were already awarded for this meeting quiz
    const alreadyAwarded = userScore.history.some(
      (h) =>
        h.event === "QUIZ_COMPLETED" &&
        h.metadata?.meetingId?.toString() === meetingId.toString(),
    );
    if (alreadyAwarded) return;

    userScore.totalPoints += points;
    userScore.history.push({
      event: "QUIZ_COMPLETED",
      pointsAwarded: points,
      metadata: { meetingId },
      timestamp: new Date(),
    });

    await userScore.save();
  } catch (err) {
    console.error("Failed to award gamification points for quiz:", err);
  }
};

// --- Retrieve / Auto-Generate Quiz ---
export const getQuizForMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    let quiz = await MeetingQuiz.findOne({ meetingId });
    if (quiz) {
      // Check if this user has already completed it to append response
      const userId = req.user.id || req.user._id;
      const response = await QuizResponse.findOne({ quizId: quiz._id, userId });
      return res.status(200).json({
        success: true,
        quiz,
        response: response || null,
      });
    }

    // Auto-generate if not found
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    let questions = [];
    if (process.env.OPENAI_API_KEY) {
      try {
        const systemPrompt =
          "You are a professional assistant that generates multiple-choice quiz questions based on meeting summaries and decisions to test the participants' retention.";
        const userPrompt = `
          Generate 3 multiple-choice questions based on the following meeting summary and details. Return ONLY a valid JSON object matching the format below.
          
          Meeting summary/details:
          """
          Title: ${meeting.title}
          Summary: ${meeting.summary || "General project discussion"}
          Description: ${meeting.description || ""}
          """
          
          Expected JSON format:
          {
            "questions": [
              {
                "questionText": "Question testing retention of a key decision or action item?",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correctOptionIndex": 0,
                "explanation": "Explanation of why Option A is correct."
              }
            ]
          }
        `;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        });

        const parsed = JSON.parse(response.choices[0].message.content);
        if (parsed && Array.isArray(parsed.questions)) {
          questions = parsed.questions;
        }
      } catch (aiErr) {
        console.error(
          "AI quiz generation failed, falling back to static generation:",
          aiErr,
        );
      }
    }

    // Static fallback if AI failed or key was missing
    if (!questions || questions.length === 0) {
      const fallback = generateStaticFallbackQuiz(meeting);
      questions = fallback.questions;
    }

    quiz = await MeetingQuiz.create({
      meetingId: meeting._id,
      questions,
    });

    return res.status(200).json({
      success: true,
      quiz,
      response: null,
    });
  } catch (err) {
    next(err);
  }
};

// --- Submit Quiz Response ---
export const submitQuizResponse = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { answers } = req.body; // Array of { questionIndex, selectedOptionIndex }
    const userId = req.user.id || req.user._id;

    if (!answers || !Array.isArray(answers)) {
      return res
        .status(400)
        .json({ success: false, message: "answers array is required" });
    }

    const quiz = await MeetingQuiz.findOne({ meetingId });
    if (!quiz) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found for this meeting" });
    }

    // Check if user already submitted
    const existingResponse = await QuizResponse.findOne({
      quizId: quiz._id,
      userId,
    });
    if (existingResponse) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted answers for this quiz",
      });
    }

    // Calculate score
    let correctCount = 0;
    answers.forEach((ans) => {
      const question = quiz.questions[ans.questionIndex];
      if (question && question.correctOptionIndex === ans.selectedOptionIndex) {
        correctCount += 1;
      }
    });

    const totalQuestions = quiz.questions.length;
    const scorePercentage =
      totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    const response = await QuizResponse.create({
      quizId: quiz._id,
      userId,
      score: scorePercentage,
      answers,
    });

    // Trigger gamification points
    const meeting = await Meeting.findById(meetingId);
    const orgId = meeting?.organization || req.user.organization;
    if (orgId) {
      await awardQuizPoints(userId, orgId, meetingId, scorePercentage);
    }

    return res.status(201).json({
      success: true,
      quiz,
      response,
      message: `Quiz submitted successfully. Score: ${scorePercentage}%`,
    });
  } catch (err) {
    next(err);
  }
};

// --- Score Analytics Processing Engine ---
export const getQuizAnalytics = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const quiz = await MeetingQuiz.findOne({ meetingId });
    if (!quiz) {
      return res.status(200).json({
        totalParticipants: 0,
        averageScore: 0,
        questionStats: [],
      });
    }

    const attempts = await QuizResponse.find({ quizId: quiz._id });
    if (attempts.length === 0) {
      return res.status(200).json({
        totalParticipants: 0,
        averageScore: 0,
        questionStats: quiz.questions.map((q) => ({
          questionText: q.questionText,
          missRate: 0,
        })),
      });
    }

    let totalScore = 0;
    const missCountByQuestion = {};
    quiz.questions.forEach((_, idx) => {
      missCountByQuestion[idx] = 0;
    });

    attempts.forEach((attempt) => {
      totalScore += attempt.score;
      attempt.answers.forEach((ans) => {
        const question = quiz.questions[ans.questionIndex];
        if (
          question &&
          question.correctOptionIndex !== ans.selectedOptionIndex
        ) {
          missCountByQuestion[ans.questionIndex] += 1;
        }
      });
    });

    const questionStats = quiz.questions.map((q, idx) => ({
      questionText: q.questionText,
      missRate: Math.round(
        ((missCountByQuestion[idx] || 0) / attempts.length) * 100,
      ),
    }));

    return res.status(200).json({
      totalParticipants: attempts.length,
      averageScore: Math.round(totalScore / attempts.length),
      questionStats,
    });
  } catch (err) {
    next(err);
  }
};

// --- Org/Team Retention Leaderboard ---
export const getOrgRetentionLeaderboard = async (req, res, next) => {
  try {
    const orgId = req.user.organization;
    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: "User is not part of an organization.",
      });
    }

    // Aggregate QuizResponses grouped by user, calculate average score and total attempts
    const rawLeaderboard = await QuizResponse.aggregate([
      {
        $lookup: {
          from: "meetingquizzes",
          localField: "quizId",
          foreignField: "_id",
          as: "quiz",
        },
      },
      { $unwind: "$quiz" },
      {
        $lookup: {
          from: "meetings",
          localField: "quiz.meetingId",
          foreignField: "_id",
          as: "meeting",
        },
      },
      { $unwind: "$meeting" },
      {
        $match: {
          "meeting.organization": new mongoose.Types.ObjectId(orgId),
        },
      },
      {
        $group: {
          _id: "$userId",
          avgScore: { $avg: "$score" },
          totalAttempts: { $sum: 1 },
        },
      },
      { $sort: { avgScore: -1, totalAttempts: -1 } },
    ]);

    const leaderboard = await Promise.all(
      rawLeaderboard.map(async (row) => {
        const User = mongoose.model("User");
        const user = await User.findById(row._id).select(
          "name email role profilePic team",
        );
        return {
          user,
          avgScore: Math.round(row.avgScore),
          totalAttempts: row.totalAttempts,
        };
      }),
    );

    return res.status(200).json({ success: true, data: leaderboard });
  } catch (err) {
    next(err);
  }
};
