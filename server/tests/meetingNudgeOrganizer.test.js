import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  previewMeetingNudges,
  triggerMeetingNudges,
} from "../services/meetingNudgeService.js";
import MeetingNudge from "../models/meetingNudgeModel.js";
import Meeting from "../models/meetingModel.js";
import ActionItem from "../models/actionItemModel.js";
import Activity from "../models/activityModel.js";

vi.mock("../models/meetingNudgeModel.js", () => ({
  default: {
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock("../models/meetingModel.js", () => ({
  default: {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock("../models/actionItemModel.js", () => ({
  default: {
    find: vi.fn(),
  },
}));

vi.mock("../models/activityModel.js", () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock("../services/notificationService.js", () => ({
  createNotification: vi.fn().mockResolvedValue({}),
}));

describe("Meeting Nudge Service (#2062)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("previews meeting nudges and computes participant readiness score", async () => {
    const mockMeeting = {
      _id: "meet_123",
      title: "Sprint Review",
      nudgesEnabled: true,
      participants: [
        {
          user: {
            _id: "user_1",
            name: "Dev Alice",
            email: "alice@test.com",
          },
        },
      ],
    };

    Meeting.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(mockMeeting),
    });

    ActionItem.find.mockResolvedValue([
      { _id: "item_1", title: "Fix bug", status: "open" },
    ]);

    Activity.findOne.mockResolvedValue(null); // Agenda not viewed

    const preview = await previewMeetingNudges("meet_123");

    expect(preview.meetingId).toBe("meet_123");
    expect(preview.meetingTitle).toBe("Sprint Review");
    expect(preview.totalParticipants).toBe(1);
    expect(preview.participants[0].unresolvedCount).toBe(1);
    expect(preview.participants[0].hasViewedAgenda).toBe(false);
    // Score starts at 100 - 10 (unresolved) - 20 (no agenda) = 70
    expect(preview.participants[0].readinessScore).toBe(70);
    expect(preview.participants[0].plannedNudges.length).toBe(3);
  });

  it("manually triggers nudge generation for organizer test send", async () => {
    const mockMeeting = {
      _id: "meet_456",
      title: "Architecture Sync",
      organization: "org_1",
      participants: [
        {
          user: {
            _id: "user_2",
            name: "Bob",
          },
        },
      ],
    };

    Meeting.findById.mockReturnValue({
      populate: vi.fn().mockResolvedValue(mockMeeting),
    });

    ActionItem.find.mockResolvedValue([]);
    Activity.findOne.mockResolvedValue({ _id: "act_1" });
    MeetingNudge.findOneAndUpdate.mockResolvedValue({
      status: "PENDING",
      createdAt: new Date(),
    });

    const result = await triggerMeetingNudges("meet_456", "org_user");
    expect(result.success).toBe(true);
    expect(result.triggeredCount).toBe(1);
  });
});
