import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../models/userModel.js", () => ({ default: {} }));
vi.mock("../models/membershipModel.js", () => ({
  default: {
    find: vi.fn().mockReturnValue({
      populate: vi.fn().mockResolvedValue([]),
    }),
  },
}));
vi.mock("../models/tagModel.js", () => ({ default: {} }));
vi.mock("../services/graphSnapshotService.js", () => ({
  captureSnapshot: vi.fn(),
}));
vi.mock("../services/eventBus.js", () => ({
  default: { emit: vi.fn(), on: vi.fn() },
}));

vi.mock("../services/MeetingStorageService.js", () => ({
  createMeetingRecord: vi.fn(),
  findMeetingById: vi.fn(),
  findMeetingByQuery: vi.fn(),
  getMeetingsQuery: vi.fn(),
  countMeetingsQuery: vi.fn(),
  deleteMeetingById: vi.fn(),
  searchMeetingsRecords: vi.fn(),
}));

import { createMeetingSchema } from "../middleware/meetingValidation.js";
import * as MeetingStorageService from "../services/MeetingStorageService.js";
import { createMeeting } from "../services/MeetingService.js";

describe("Schedule meeting metadata.tags wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates tags in createMeetingSchema without throwing strict errors", () => {
    const rawData = {
      title: "Product Roadmap Sync",
      description: "H2 Planning",
      meetingType: "internal",
      date: "2026-11-01",
      time: "10:00",
      tags: ["product", "roadmap", "h2"],
    };

    const parsed = createMeetingSchema.parse(rawData);
    expect(parsed.tags).toEqual(["product", "roadmap", "h2"]);
  });

  it("persists tags through MeetingService.createMeeting to MeetingStorageService", async () => {
    MeetingStorageService.createMeetingRecord.mockResolvedValue({
      _id: "m-789",
      title: "Product Roadmap Sync",
      tags: ["product", "roadmap"],
    });

    const data = {
      title: "Product Roadmap Sync",
      meetingType: "internal",
      date: "2026-11-01",
      time: "10:00",
      tags: ["product", "roadmap"],
    };

    await createMeeting("user-1", "org-1", data);

    expect(MeetingStorageService.createMeetingRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Product Roadmap Sync",
        tags: ["product", "roadmap"],
      }),
    );
  });
});
