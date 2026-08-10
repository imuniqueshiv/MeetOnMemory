import { vi, describe, it, expect, beforeEach } from "vitest";
import { notifyLiveMeeting } from "../controllers/meetingController.js";

// Mock the MeetingService
const mockNotifyLiveMeetingParticipants = vi.fn();
vi.mock("../services/MeetingService.js", () => ({
  notifyLiveMeetingParticipants: (...args) =>
    mockNotifyLiveMeetingParticipants(...args),
}));

const makeRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status: vi.fn(function (code) {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn(function (body) {
      res.body = body;
      return res;
    }),
  };
  return res;
};

const makeNext = () => {
  const next = vi.fn(function (err) {
    next.error = err;
  });
  return next;
};

describe("Live Meeting Invitation Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should accept valid participants list", async () => {
    mockNotifyLiveMeetingParticipants.mockResolvedValue({ count: 1 });

    const req = {
      user: { _id: "user123", organization: "org123" },
      body: {
        roomId: "room123",
        participants: [{ name: "John Doe", email: "john@example.com" }],
      },
    };
    const res = makeRes();
    const next = makeNext();

    await notifyLiveMeeting(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should reject invalid email formats", async () => {
    const req = {
      user: { _id: "user123", organization: "org123" },
      body: {
        roomId: "room123",
        participants: [{ name: "John Doe", email: "not-an-email" }],
      },
    };
    const res = makeRes();
    const next = makeNext();

    await notifyLiveMeeting(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.error;
    expect(error.name).toBe("ZodError");
    // Ensure email validation error is raised
    const emailIssue = error.issues.find((issue) =>
      issue.path.includes("email"),
    );
    expect(emailIssue).toBeDefined();
  });

  it("should reject empty name", async () => {
    const req = {
      user: { _id: "user123", organization: "org123" },
      body: {
        roomId: "room123",
        participants: [{ name: "", email: "john@example.com" }],
      },
    };
    const res = makeRes();
    const next = makeNext();

    await notifyLiveMeeting(req, res, next);

    expect(next).toHaveBeenCalled();
    const error = next.error;
    expect(error.name).toBe("ZodError");
  });
});
