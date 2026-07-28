import { describe, it, expect, beforeEach, vi as jest } from "vitest";

jest.mock("../services/EmailService.js", () => ({
  default: {
    sendMail: jest.fn(),
  },
}));

jest.mock("../models/meetingModel.js", () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("../models/userModel.js", () => ({
  default: {
    find: jest.fn(),
  },
}));

const MeetingDigestService = (
  await import("../services/MeetingDigestService.js")
).default;
const EmailService = (await import("../services/EmailService.js")).default;
const Meeting = (await import("../models/meetingModel.js")).default;
const User = (await import("../models/userModel.js")).default;

describe("MeetingDigestService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("buildDigestHtml", () => {
    it("should build HTML with decisions and action items", () => {
      const meeting = {
        _id: "meeting-123",
        title: "Test Meeting",
        date: new Date("2023-10-01T10:00:00Z").toISOString(),
        summary: "This was a good meeting.",
        structuredMoM: {
          decisions: ["Decision 1", "Decision 2"],
          action_items: [
            { owner: "Alice", task: "Do something", due_date: "Tomorrow" },
          ],
        },
      };

      const html = MeetingDigestService.buildDigestHtml(meeting);

      expect(html).toContain("Test Meeting");
      expect(html).toContain("This was a good meeting.");
      expect(html).toContain("Decision 1");
      expect(html).toContain("Alice");
      expect(html).toContain("Do something");
      expect(html).toContain("View Full Meeting Details");
    });
  });

  describe("sendMeetingDigest", () => {
    it("should send email to participants with emailDigestEnabled !== false", async () => {
      const meetingId = "meeting-123";

      Meeting.findById.mockResolvedValue({
        _id: meetingId,
        title: "Test Meeting",
        participants: [
          { name: "User1", email: "user1@example.com" },
          { name: "User2", email: "user2@example.com" },
          { name: "User3", email: "user3@example.com" },
        ],
      });

      User.find.mockResolvedValue([
        { email: "user1@example.com", emailDigestEnabled: true },
        { email: "user2@example.com", emailDigestEnabled: false },
        // user3 not found in db, should default to true
      ]);

      EmailService.sendMail.mockResolvedValue(true);

      const result = await MeetingDigestService.sendMeetingDigest(meetingId);

      expect(result.success).toBe(true);
      expect(result.recipientsSentTo).toBe(2); // user1 and user3
      expect(EmailService.sendMail).toHaveBeenCalledTimes(2);

      const calls = EmailService.sendMail.mock.calls;
      const emailsSentTo = calls.map((call) => call[0].to);
      expect(emailsSentTo).toContain("user1@example.com");
      expect(emailsSentTo).toContain("user3@example.com");
      expect(emailsSentTo).not.toContain("user2@example.com");
    });

    it("should return false if no participants have emails", async () => {
      Meeting.findById.mockResolvedValue({
        _id: "meeting-123",
        participants: [{ name: "User1" }, { name: "User2", email: "" }],
      });

      const result =
        await MeetingDigestService.sendMeetingDigest("meeting-123");

      expect(result.success).toBe(false);
      expect(result.message).toContain(
        "No participants with email addresses found",
      );
      expect(EmailService.sendMail).not.toHaveBeenCalled();
    });

    it("should return false if all participants opted out", async () => {
      Meeting.findById.mockResolvedValue({
        _id: "meeting-123",
        participants: [{ name: "User1", email: "user1@example.com" }],
      });

      User.find.mockResolvedValue([
        { email: "user1@example.com", emailDigestEnabled: false },
      ]);

      const result =
        await MeetingDigestService.sendMeetingDigest("meeting-123");

      expect(result.success).toBe(false);
      expect(result.message).toContain("opted out");
      expect(EmailService.sendMail).not.toHaveBeenCalled();
    });
  });
});
