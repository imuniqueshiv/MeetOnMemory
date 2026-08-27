// server/tests/asyncMeeting.test.js
import {
  submitAsyncResponse,
  convertToAsync,
  asyncMeetings,
  reminderJobsLog,
} from "../controllers/asyncMeetingController";

describe("Asynchronous Meeting Lifecycle Engine", () => {
  const sampleId = "async-881";

  beforeEach(() => {
    delete asyncMeetings[sampleId];
    reminderJobsLog.length = 0;
  });

  test("Should block submission attempts outright when a meeting has passed its lock deadline", async () => {
    // Inject a meeting whose deadline expired in the past
    asyncMeetings[sampleId] = {
      meetingId: sampleId,
      deadline: new Date(Date.now() - 10000).toISOString(), // 10s ago
      submissions: {},
    };

    const mockReq = {
      params: { meetingId: sampleId },
      body: { userId: "usr-1", responses: "Late updates" },
    };
    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await submitAsyncResponse(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error:
          "SUBMISSION_LOCKED: The submission deadline has passed for this asynchronous meeting.",
      }),
    );
  });

  test("Should schedule notification job 24 hours prior to configured target deadline", async () => {
    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48 hours out
    const mockReq = {
      params: { meetingId: sampleId },
      body: { deadline: futureDate, attendees: ["usr-1"] },
    };
    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await convertToAsync(mockReq, mockRes);
    expect(reminderJobsLog.length).toBe(1);

    const targetJobTime = new Date(reminderJobsLog[0].scheduledFor);
    const expectedTime = new Date(
      new Date(futureDate).getTime() - 24 * 60 * 60 * 1000,
    );
    expect(targetJobTime.getTime()).toBeCloseTo(expectedTime.getTime(), -2);
  });
});
