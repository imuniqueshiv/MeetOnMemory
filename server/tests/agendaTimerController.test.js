import { jest } from "@jest/globals";

const mockFindById = jest.fn();

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    findById: mockFindById,
  },
}));

const { startAgendaItem, stopAgendaItem, skipAgendaItem, getAgendaPacingReport } =
  await import("../controllers/agendaTimerController.js");

describe("agendaTimerController authorization (#818, #884)", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  const createMockMeeting = (overrides = {}) => {
    const agendaItem = {
      _id: "item123",
      status: "pending",
      duration: 10,
      actualDuration: 0,
      startedAt: null,
      completedAt: null,
    };
    const agendaItemsArr = [agendaItem];
    agendaItemsArr.id = (id) => (id === "item123" ? agendaItem : null);

    return {
      _id: "meeting123",
      uploadedBy: "uploader_1",
      organization: "org_1",
      agendaItems: agendaItemsArr,
      agendaProgress: "not_started",
      save: jest.fn().mockResolvedValue(true),
      ...overrides,
    };
  };

  it("should allow the uploader to start an agenda item", async () => {
    const meeting = createMockMeeting();
    mockFindById.mockReturnValue({
      select: jest.fn().mockResolvedValue(meeting),
    });
    mockFindById.mockResolvedValue(meeting);

    req = {
      params: { meetingId: "meeting123", itemId: "item123" },
      user: { _id: "uploader_1", id: "uploader_1", role: "member", organization: "org_1" },
      app: { get: () => null },
    };

    await startAgendaItem(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("should allow an organization admin to start an agenda item", async () => {
    const meeting = createMockMeeting();
    mockFindById.mockResolvedValue(meeting);

    req = {
      params: { meetingId: "meeting123", itemId: "item123" },
      user: { _id: "admin_user", id: "admin_user", role: "admin", organization: "org_1" },
      app: { get: () => null },
    };

    await startAgendaItem(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("should allow an organization owner to start an agenda item", async () => {
    const meeting = createMockMeeting();
    mockFindById.mockResolvedValue(meeting);

    req = {
      params: { meetingId: "meeting123", itemId: "item123" },
      user: { _id: "owner_user", id: "owner_user", role: "owner", organization: "org_1" },
      app: { get: () => null },
    };

    await startAgendaItem(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("should allow an organization admin to stop an agenda item", async () => {
    const meeting = createMockMeeting();
    meeting.agendaItems[0].status = "active";
    meeting.agendaItems[0].startedAt = new Date();
    mockFindById.mockResolvedValue(meeting);

    req = {
      params: { meetingId: "meeting123", itemId: "item123" },
      user: { _id: "admin_user", id: "admin_user", role: "admin", organization: "org_1" },
      app: { get: () => null },
    };

    await stopAgendaItem(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("should allow an organization owner to skip an agenda item", async () => {
    const meeting = createMockMeeting();
    mockFindById.mockResolvedValue(meeting);

    req = {
      params: { meetingId: "meeting123", itemId: "item123" },
      user: { _id: "owner_user", id: "owner_user", role: "owner", organization: "org_1" },
      app: { get: () => null },
    };

    await skipAgendaItem(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("should reject a non-uploader, non-admin user in the same org", async () => {
    const meeting = createMockMeeting();
    mockFindById.mockResolvedValue(meeting);

    req = {
      params: { meetingId: "meeting123", itemId: "item123" },
      user: { _id: "member_user", id: "member_user", role: "member", organization: "org_1" },
      app: { get: () => null },
    };

    await startAgendaItem(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Not authorized to manage timers",
    });
  });

  it("should reject an admin from a different organization", async () => {
    const meeting = createMockMeeting();
    mockFindById.mockResolvedValue(meeting);

    req = {
      params: { meetingId: "meeting123", itemId: "item123" },
      user: { _id: "other_admin", id: "other_admin", role: "admin", organization: "other_org" },
      app: { get: () => null },
    };

    await startAgendaItem(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Not authorized to manage timers",
    });
  });

  describe("getAgendaPacingReport authorization (#884)", () => {
    it("should allow authorized user to view agenda pacing report", async () => {
      const meeting = createMockMeeting();
      mockFindById.mockReturnValue({
        select: jest.fn().mockResolvedValue(meeting),
      });

      req = {
        params: { meetingId: "meeting123" },
        user: { _id: "uploader_1", id: "uploader_1", role: "member", organization: "org_1" },
      };

      await getAgendaPacingReport(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, reportData: expect.any(Array) }),
      );
    });

    it("should reject unauthorized user from viewing agenda pacing report with 403 Forbidden", async () => {
      const meeting = createMockMeeting();
      mockFindById.mockReturnValue({
        select: jest.fn().mockResolvedValue(meeting),
      });

      req = {
        params: { meetingId: "meeting123" },
        user: { _id: "unauthorized_user", id: "unauthorized_user", role: "member", organization: "org_1" },
      };

      await getAgendaPacingReport(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Not authorized to view agenda report",
      });
    });
  });
});
