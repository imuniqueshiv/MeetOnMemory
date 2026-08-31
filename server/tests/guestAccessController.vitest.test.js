import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../models/meetingModel.js", () => {
  const mockMeeting = {
    findById: vi.fn(),
  };
  return { default: mockMeeting };
});

vi.mock("../models/guestAccessTokenModel.js", () => {
  function MockGuestAccessToken(data) {
    Object.assign(this, data);
    this._id = "token-123";
    this.save = vi.fn().mockResolvedValue(this);
  }
  MockGuestAccessToken.create = vi.fn();
  MockGuestAccessToken.find = vi.fn();
  MockGuestAccessToken.findOne = vi.fn();
  MockGuestAccessToken.findById = vi.fn();
  return { default: MockGuestAccessToken };
});

vi.mock("../models/guestFeedbackModel.js", () => {
  function MockGuestFeedback(data) {
    Object.assign(this, data);
    this._id = "feedback-123";
    this.save = vi.fn().mockResolvedValue(this);
  }
  MockGuestFeedback.create = vi.fn();
  MockGuestFeedback.find = vi.fn();
  return { default: MockGuestFeedback };
});

vi.mock("../services/AuditService.js", () => ({
  default: {
    logAction: vi.fn().mockResolvedValue(true),
  },
}));

const {
  getHostAnalytics,
  exportFeedbackCSV,
  submitGuestFeedback,
  createToken,
  revokeToken,
} = await import("../controllers/guestAccessController.js");

const Meeting = (await import("../models/meetingModel.js")).default;
const GuestAccessToken = (await import("../models/guestAccessTokenModel.js"))
  .default;
const GuestFeedback = (await import("../models/guestFeedbackModel.js")).default;

describe("guestAccessController (#2454)", () => {
  let req, res, next;
  const mockUserId = "507f1f77bcf86cd799439011";
  const mockOrgId = "507f1f77bcf86cd799439022";
  const mockMeetingId = "507f1f77bcf86cd799439033";

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
    req = {
      user: {
        _id: mockUserId,
        id: mockUserId,
        organization: mockOrgId,
        role: "admin",
      },
      params: {},
      query: {},
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
    };
  });

  describe("getHostAnalytics", () => {
    it("returns computed views, joins, feedback count, token history, and reviews", async () => {
      req.params = { meetingId: mockMeetingId };

      Meeting.findById.mockResolvedValue({
        _id: mockMeetingId,
        uploadedBy: mockUserId,
        organization: mockOrgId,
      });

      const mockTokens = [
        {
          _id: "token-1",
          token: "raw-token-1",
          guestEmail: "guest1@example.com",
          label: "Auditor Access",
          currentViews: 5,
          viewCount: 5,
          joinCount: 3,
          maxViews: 10,
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
          lastUsedAt: new Date(),
          revoked: false,
        },
        {
          _id: "token-2",
          token: "raw-token-2",
          guestEmail: "guest2@example.com",
          label: "Reviewer",
          currentViews: 2,
          viewCount: 2,
          joinCount: 1,
          maxViews: 0,
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
          lastUsedAt: null,
          revoked: false,
        },
      ];

      const mockFeedback = [
        {
          _id: "fb-1",
          meetingId: mockMeetingId,
          guestName: "Alice Auditor",
          guestEmail: "guest1@example.com",
          rating: 5,
          comments: "Clear meeting agenda and notes",
          createdAt: new Date(),
        },
      ];

      GuestAccessToken.find.mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockTokens),
      });

      GuestFeedback.find.mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockFeedback),
      });

      await getHostAnalytics(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: {
            totalViews: 7,
            totalJoins: 4,
            feedbackCount: 1,
          },
          tokens: expect.arrayContaining([
            expect.objectContaining({
              id: "token-1",
              token: "raw-token-1",
              guestEmail: "guest1@example.com",
              label: "Auditor Access",
              isActive: true,
              lastUsedAt: expect.any(Date),
            }),
          ]),
          feedback: expect.arrayContaining([
            expect.objectContaining({
              guestName: "Alice Auditor",
              rating: 5,
              comments: "Clear meeting agenda and notes",
            }),
          ]),
        }),
      );
    });

    it("rejects unauthorized user who is not host or admin", async () => {
      req.params = { meetingId: mockMeetingId };
      req.user = {
        _id: "other-user-id",
        role: "member",
        organization: "different-org-id",
      };

      Meeting.findById.mockResolvedValue({
        _id: mockMeetingId,
        uploadedBy: "host-user-id",
        organization: mockOrgId,
      });

      await getHostAnalytics(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: "Unauthorized to view analytics for this meeting",
        }),
      );
    });
  });

  describe("exportFeedbackCSV", () => {
    it("streams formatted CSV with proper headers and escaped rows", async () => {
      req.query = { meetingId: mockMeetingId };

      Meeting.findById.mockResolvedValue({
        _id: mockMeetingId,
        uploadedBy: mockUserId,
        organization: mockOrgId,
      });

      GuestFeedback.find.mockReturnValue({
        sort: vi.fn().mockResolvedValue([
          {
            createdAt: new Date("2026-10-01T12:00:00Z"),
            guestName: 'Bob "The Builder"',
            rating: 4,
            comments: 'Great sync, "well structured"!',
          },
        ]),
      });

      await exportFeedbackCSV(req, res);

      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv");
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        `attachment; filename=meeting-${mockMeetingId}-feedback.csv`,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining(
          'Date,Guest Name,Rating,Comments\n"2026-10-01","Bob ""The Builder""","4","Great sync, ""well structured""!"\n',
        ),
      );
    });
  });

  describe("submitGuestFeedback", () => {
    it("allows a guest with a valid token to submit feedback", async () => {
      req.params = { token: "valid-guest-token" };
      req.body = {
        rating: 5,
        comments: "Excellent presentation",
        guestName: "Charlie",
      };

      const mockTokenRecord = {
        _id: "token-1",
        meetingId: { _id: mockMeetingId },
        guestEmail: "charlie@example.com",
        expiresAt: new Date(Date.now() + 86400000),
        revoked: false,
        currentViews: 1,
        save: vi.fn().mockResolvedValue(true),
      };

      GuestAccessToken.findOne.mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockTokenRecord),
      });

      GuestFeedback.create.mockResolvedValue({
        _id: "fb-new",
        meetingId: mockMeetingId,
        guestName: "Charlie",
        rating: 5,
        comments: "Excellent presentation",
      });

      await submitGuestFeedback(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Feedback submitted successfully",
          feedback: expect.objectContaining({
            guestName: "Charlie",
            rating: 5,
          }),
        }),
      );
    });
  });

  describe("createToken & revokeToken", () => {
    it("creates token with label and metadata", async () => {
      req.params = { meetingId: mockMeetingId };
      req.body = {
        guestEmail: "reviewer@external.com",
        label: "Q3 Reviewer",
        permissions: ["view_summary"],
        expiresAt: "2026-10-15T00:00:00Z",
        maxViews: 5,
      };

      Meeting.findById.mockResolvedValue({
        _id: mockMeetingId,
        organization: mockOrgId,
      });

      GuestAccessToken.create.mockResolvedValue({
        _id: "token-created-1",
        guestEmail: "reviewer@external.com",
        label: "Q3 Reviewer",
      });

      await createToken(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Guest token created successfully",
          token: expect.any(String),
        }),
      );
    });

    it("revokes token by ID", async () => {
      req.params = { tokenId: "token-123" };

      const mockToken = {
        _id: "token-123",
        revoked: false,
        save: vi.fn().mockResolvedValue(true),
      };

      GuestAccessToken.findById.mockResolvedValue(mockToken);

      await revokeToken(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Token revoked",
        }),
      );
    });
  });
});
