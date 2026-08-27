// server/controllers/meetingQuizController.js

// Mock persistent database stores
const quizBanks = {};
const quizAttempts = {};

// --- Question Bank CRUD Engine ---
export const updateQuizBank = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { questions } = req.body; // Array of { id, questionText, options: [], correctAnswerIndex }

    quizBanks[meetingId] = questions || [];
    return res.status(200).json({ success: true, data: quizBanks[meetingId] });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update quiz bank" });
  }
};

// --- Score Analytics Processing Engine ---
export const getQuizAnalytics = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const questions = quizBanks[meetingId] || [];
    const attempts = quizAttempts[meetingId] || [];

    if (attempts.length === 0) {
      return res
        .status(200)
        .json({ passRate: 0, totalAttempts: 0, perQuestionStats: [] });
    }

    let passedCount = 0;
    const questionCorrectCounts = {};
    questions.forEach((q) => {
      questionCorrectCounts[q.id] = 0;
    });

    attempts.forEach((attempt) => {
      let score = 0;
      attempt.answers.forEach((ans) => {
        const question = questions.find((q) => q.id === ans.questionId);
        if (question && question.correctAnswerIndex === ans.selectedIndex) {
          score += 1;
          questionCorrectCounts[ans.questionId] += 1;
        }
      });

      const percent =
        questions.length > 0 ? (score / questions.length) * 100 : 0;
      if (percent >= 70) passedCount += 1; // 70% static pass threshold
    });

    const perQuestionStats = questions.map((q) => ({
      questionId: q.id,
      questionText: q.questionText,
      correctPercentage:
        ((questionCorrectCounts[q.id] || 0) / attempts.length) * 100,
    }));

    return res.status(200).json({
      passRate: (passedCount / attempts.length) * 100,
      totalAttempts: attempts.length,
      perQuestionStats,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to compile quiz metrics" });
  }
};

// --- Existing Participant Submissions Hook ---
export const submitQuizAttempt = async (req, res) => {
  const { meetingId } = req.params;
  const { userId, answers } = req.body;
  if (!quizAttempts[meetingId]) quizAttempts[meetingId] = [];
  quizAttempts[meetingId].push({ userId, answers, timestamp: new Date() });
  return res.status(201).json({ success: true });
};
