import { jest } from "@jest/globals";

const mockGetOrgActivities = jest.fn();
const mockGetActivityStats = jest.fn();

jest.unstable_mockModule("../services/activityService.js", () => ({
  getOrgActivities: mockGetOrgActivities,
  getActivityStats: mockGetActivityStats,
}));

const { getActivities, getActivityStats } = await import(
  "../controllers/activityController.js"
);

describe("activityController - organization resolution (#812)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getActivities", () => {
    it("should resolve organization using req.user.organization and return activities", async () => {
      const req = {
        user: {
          _id: "user_123",
          organization: "org_456",
        },
        query: { page: "1", limit: "10" },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const mockResult = {
        activities: [{ _id: "act_1", action: "meeting.created" }],
        totalActivities: 1,
        totalPages: 1,
        currentPage: 1,
      };
      mockGetOrgActivities.mockResolvedValue(mockResult);

      await getActivities(req, res);

      expect(mockGetOrgActivities).toHaveBeenCalledWith("org_456", {
        page: 1,
        limit: 10,
        action: undefined,
        actor: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it("should return 400 when user has no organization set", async () => {
      const req = {
        user: {
          _id: "user_123",
          organization: null,
        },
        query: {},
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await getActivities(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "No organization selected.",
      });
      expect(mockGetOrgActivities).not.toHaveBeenCalled();
    });
  });

  describe("getActivityStats", () => {
    it("should resolve organization using req.user.organization and return stats", async () => {
      const req = {
        user: {
          _id: "user_123",
          organization: "org_789",
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const mockStats = { totalActivities: 42, activeUsers: 5 };
      mockGetActivityStats.mockResolvedValue(mockStats);

      await getActivityStats(req, res);

      expect(mockGetActivityStats).toHaveBeenCalledWith("org_789");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockStats);
    });

    it("should return 400 when user has no organization set", async () => {
      const req = {
        user: {
          _id: "user_123",
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await getActivityStats(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "No organization selected.",
      });
      expect(mockGetActivityStats).not.toHaveBeenCalled();
    });
  });
});
