import { jest } from "@jest/globals";

const mockFind = jest.fn().mockReturnThis();
const mockSort = jest.fn().mockReturnThis();
const mockSelect = jest.fn();

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    find: mockFind,
    sort: mockSort,
    select: mockSelect,
  },
}));

// meetingController eagerly imports zod + calendarSyncService; both have dense
// ESM graphs that hit Jest's VM "module is already linked" on this runtime.
// Passthrough mocks keep controller org-scoping behaviour under test without
// pulling those graphs into the MeetingService Cluster C link set.
const zodPassthroughSchema = {
  parse: (value) => value,
  safeParse: (value) => ({ success: true, data: value }),
};
const zodChain = new Proxy(zodPassthroughSchema, {
  get(target, prop) {
    if (prop in target) return target[prop];
    return () => zodChain;
  },
});
jest.unstable_mockModule("zod", () => ({
  z: new Proxy(
    {},
    {
      get() {
        return (..._args) => zodChain;
      },
    },
  ),
}));
jest.unstable_mockModule("../services/calendarSyncService.js", () => ({
  pushMeetingToIntegrations: jest.fn().mockResolvedValue(undefined),
}));

const Meeting = (await import("../models/meetingModel.js")).default;
const MeetingStorageService =
  await import("../services/MeetingStorageService.js");
const MeetingService = await import("../services/MeetingService.js");
const { searchMeetingsByText } =
  await import("../controllers/meetingController.js");
const { requireOrgMembership } = await import("../middleware/rbac.js");

describe("Meeting Search Organization Scoping & Isolation (#387)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("MeetingStorageService.searchMeetingsRecords", () => {
    it("should include filter in Meeting.find query when filter is provided", async () => {
      const searchQuery = "quarterly budget";
      const filter = { organization: "org_123" };

      mockFind.mockReturnValue({
        sort: mockSort.mockReturnValue({
          select: mockSelect.mockResolvedValue([
            { _id: "m1", title: "Q3 Budget", organization: "org_123" },
          ]),
        }),
      });

      const results = await MeetingStorageService.searchMeetingsRecords(
        searchQuery,
        filter,
      );

      expect(Meeting.find).toHaveBeenCalledWith({
        $text: { $search: searchQuery },
        organization: "org_123",
      });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Q3 Budget");
    });
  });

  describe("MeetingService.searchMeetings", () => {
    it("should construct $or filter combining orgId and userId", async () => {
      const orgId = "org_A";
      const userId = "user_A";
      const queryParams = { query: "strategy" };

      mockFind.mockReturnValue({
        sort: mockSort.mockReturnValue({
          select: mockSelect.mockResolvedValue([
            { _id: "m1", title: "Strategy Session", organization: "org_A" },
          ]),
        }),
      });

      const result = await MeetingService.searchMeetings(
        queryParams,
        orgId,
        userId,
      );

      expect(Meeting.find).toHaveBeenCalledWith({
        $text: { $search: "strategy" },
        $or: [{ organization: "org_A" }, { uploadedBy: "user_A" }],
      });
      expect(result.count).toBe(1);
      expect(result.results[0].title).toBe("Strategy Session");
    });

    it("should construct organization-only filter when userId is not provided", async () => {
      const orgId = "org_B";
      const queryParams = { query: "security audit" };

      mockFind.mockReturnValue({
        sort: mockSort.mockReturnValue({
          select: mockSelect.mockResolvedValue([]),
        }),
      });

      await MeetingService.searchMeetings(queryParams, orgId, null);

      expect(Meeting.find).toHaveBeenCalledWith({
        $text: { $search: "security audit" },
        $or: [{ organization: "org_B" }],
      });
    });
  });

  describe("meetingController.searchMeetingsByText", () => {
    it("should extract user organization and id and pass them to MeetingService.searchMeetings", async () => {
      const req = {
        user: {
          id: "user_123",
          organization: "org_123",
        },
        body: {
          query: "roadmap",
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      mockFind.mockReturnValue({
        sort: mockSort.mockReturnValue({
          select: mockSelect.mockResolvedValue([
            { _id: "m2", title: "2026 Roadmap", organization: "org_123" },
          ]),
        }),
      });

      await searchMeetingsByText(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          count: 1,
          results: expect.arrayContaining([
            expect.objectContaining({ title: "2026 Roadmap" }),
          ]),
        }),
      );
    });
  });

  describe("requireOrgMembership Middleware Authorization Check", () => {
    it("should reject search request with 403 Forbidden if user has no organization", () => {
      const req = {
        user: {
          id: "user_no_org",
          organization: null,
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      requireOrgMembership(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Forbidden: Organization membership required",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should allow search request if user belongs to an organization", () => {
      const req = {
        user: {
          id: "user_with_org",
          organization: "org_999",
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      requireOrgMembership(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
