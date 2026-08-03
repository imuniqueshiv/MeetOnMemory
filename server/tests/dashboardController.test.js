import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDashboardMetrics } from "../controllers/dashboardController.js";
import ActionItem from "../models/actionItemModel.js";
import Notification from "../models/notificationModel.js";
import Meeting from "../models/meetingModel.js";

vi.mock("../models/actionItemModel.js", () => ({
  default: {
    countDocuments: vi.fn(),
  },
}));

vi.mock("../models/notificationModel.js", () => ({
  default: {
    countDocuments: vi.fn(),
  },
}));

vi.mock("../models/meetingModel.js", () => ({
  default: {
    countDocuments: vi.fn(),
  },
}));

describe("Dashboard Controller Metrics (#811)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return correct non-zero metric counts when valid data exists", async () => {
    ActionItem.countDocuments.mockResolvedValue(5);
    Notification.countDocuments.mockResolvedValue(3);
    Meeting.countDocuments.mockResolvedValue(8);

    const req = {
      user: {
        id: "user-123",
        email: "user@example.com",
        name: "Test User",
        organization: "org-123",
      },
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await getDashboardMetrics(req, res);

    expect(ActionItem.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: "org-123",
        owner: {
          $in: ["user-123", "user-123", "user@example.com", "Test User"],
        },
      }),
    );

    expect(Notification.countDocuments).toHaveBeenCalledWith({
      user: "user-123",
      isRead: false,
    });

    expect(Meeting.countDocuments).toHaveBeenCalledWith({
      organization: "org-123",
      date: expect.objectContaining({ $gte: expect.any(Date) }),
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Success",
      metrics: {
        overdueTasks: 5,
        unreadNotifications: 3,
        upcomingMeetings: 8,
      },
    });
  });

  it("should return 400 error when organization context is missing", async () => {
    const req = { user: { id: "user-123" } };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await getDashboardMetrics(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Organization context is missing",
    });
  });
});
