import mongoose from "mongoose";
import MeetingQuiz from "../models/meetingQuizModel.js";

describe("Meeting Retention Quiz Models", () => {
  beforeAll(() => {
    // No-op for this test
  });

  afterAll(() => {
    // No-op for this test
  });

  beforeEach(() => {
    // No-op for this test
  });

  it("should create a meeting quiz successfully", async () => {
    const quiz = new MeetingQuiz({
      meetingId: new mongoose.Types.ObjectId(),
      questions: [
        {
          questionText: "What was discussed?",
          options: ["A", "B", "C"],
          correctOptionIndex: 1,
          explanation: "Because B was the topic.",
        },
      ],
    });

    const error = quiz.validateSync();
    expect(error).toBeUndefined();
    expect(quiz.meetingId).toBeDefined();
    expect(quiz.questions.length).toBe(1);
    expect(quiz.questions[0].explanation).toBe("Because B was the topic.");
  });

  it("should calculate score correctly (mock logic)", () => {
    const questions = [
      { correctOptionIndex: 0 },
      { correctOptionIndex: 2 },
      { correctOptionIndex: 1 },
    ];
    const answers = [
      { questionIndex: 0, selectedOptionIndex: 0 }, // correct
      { questionIndex: 1, selectedOptionIndex: 1 }, // wrong
      { questionIndex: 2, selectedOptionIndex: 1 }, // correct
    ];

    let correctCount = 0;
    questions.forEach((q, index) => {
      const a = answers.find((ans) => ans.questionIndex === index);
      if (a && a.selectedOptionIndex === q.correctOptionIndex) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / questions.length) * 100);
    expect(score).toBe(67);
  });
});
