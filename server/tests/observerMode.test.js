import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockMeetingFindById = jest.fn();
const mockUserFindById = jest.fn();
const mockCreateNotification = jest.fn();

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    findById: (...args) => mockMeetingFindById(...args),
  },
}));

jest.unstable_mockModule("../models/userModel.js", () => ({
  default: {
    findById: (...args) => mockUserFindById(...args),
  },
}));

jest.unstable_mockModule("../services/notificationService.js", () => ({
  createNotification: (...args) => mockCreateNotification(...args),
}));

const { requestToShadow, approveShadowRequest, denyShadowRequest } =
  await import("../controllers/observerController.js");

describe("Observer Mode Controller (#2445)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should send a shadow request successfully", async () => {
    const mockMeeting = {
      _id: "m_1",
      title: "Board Sync",
      allowObservers: true,
      uploadedBy: "u_host",
      participants: [{ user: "u_host" }],
    };

    mockMeetingFindById.mockResolvedValue(mockMeeting);
    mockUserFindById.mockResolvedValue({ _id: "u_req", name: "Requester" });

    const req = {
      params: { meetingId: "m_1" },
      user: { _id: "u_req" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await requestToShadow(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "shadow_request",
        recipient: "u_host",
      }),
    );
  });

  it("should approve a shadow request when caller is host", async () => {
    const mockSave = jest.fn().mockResolvedValue(true);
    const mockMeeting = {
      _id: "m_1",
      title: "Board Sync",
      uploadedBy: "u_host",
      participants: [{ user: "u_host" }],
      save: mockSave,
    };

    mockMeetingFindById.mockResolvedValue(mockMeeting);
    mockUserFindById.mockResolvedValue({
      _id: "u_req",
      name: "Requester",
      email: "req@example.com",
    });

    const req = {
      params: { meetingId: "m_1", userId: "u_req" },
      user: { _id: "u_host" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await approveShadowRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockMeeting.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user: "u_req",
          role: "observer",
        }),
      ]),
    );
    expect(mockSave).toHaveBeenCalled();
  });

  it("should reject approval when caller is not the host", async () => {
    const mockMeeting = {
      _id: "m_1",
      uploadedBy: "u_host",
      participants: [],
    };

    mockMeetingFindById.mockResolvedValue(mockMeeting);

    const req = {
      params: { meetingId: "m_1", userId: "u_req" },
      user: { _id: "not_the_host" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await approveShadowRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
