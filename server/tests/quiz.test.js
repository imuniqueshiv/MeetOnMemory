// server/tests/quiz.test.js
import { updateQuizBank } from "../controllers/meetingQuizController";

describe("Retention Quiz Pipeline Integration Suite", () => {
  const targetMeetingId = "meet-772";

  test("Should accurately save custom questions to the backend repository layer", async () => {
    const mockReq = {
      params: { meetingId: targetMeetingId },
      body: {
        questions: [
          {
            id: "1",
            questionText: "Is Node asynchronous?",
            options: ["Yes", "No"],
            correctAnswerIndex: 0,
          },
        ],
      },
    };
    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await updateQuizBank(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });
});
