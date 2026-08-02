import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../models/userModel.js", () => ({ default: {} }));
vi.mock("../models/membershipModel.js", () => ({ default: {} }));
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

import * as MeetingStorageService from "../services/MeetingStorageService.js";
import { getAllMeetings } from "../services/MeetingService.js";

describe("getAllMeetings pagination, search, and sorting (#909)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MeetingStorageService.getMeetingsQuery.mockResolvedValue([]);
    MeetingStorageService.countMeetingsQuery.mockResolvedValue(0);
  });

  it("paginates with skip/limit and default createdAt desc sort", async () => {
    MeetingStorageService.getMeetingsQuery.mockResolvedValue([
      { _id: "m1", title: "One" },
    ]);
    MeetingStorageService.countMeetingsQuery.mockResolvedValue(25);

    const result = await getAllMeetings("user-1", "org-1", {
      page: 2,
      limit: 10,
    });

    expect(MeetingStorageService.getMeetingsQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: expect.any(Array),
      }),
      10,
      10,
      { createdAt: -1 },
    );
    expect(result.pagination).toEqual({
      total: 25,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
    expect(result.meetings).toHaveLength(1);
  });

  it("applies case-insensitive title/summary search on the server", async () => {
    await getAllMeetings("user-1", "org-1", {
      page: 1,
      limit: 9,
      search: "budget*",
    });

    const [query] = MeetingStorageService.getMeetingsQuery.mock.calls[0];
    expect(query).toEqual(
      expect.objectContaining({
        $and: expect.arrayContaining([
          {
            $or: [
              { title: { $regex: "budget\\*", $options: "i" } },
              { summary: { $regex: "budget\\*", $options: "i" } },
            ],
          },
        ]),
      }),
    );
    expect(MeetingStorageService.countMeetingsQuery).toHaveBeenCalledWith(
      query,
    );
  });

  it("filters by meetingType when provided", async () => {
    await getAllMeetings("user-1", null, {
      meetingType: "standup",
      page: 1,
      limit: 10,
    });

    const [query] = MeetingStorageService.getMeetingsQuery.mock.calls[0];
    expect(query.$and).toEqual(
      expect.arrayContaining([{ meetingType: "standup" }]),
    );
  });

  it("supports title ascending sort", async () => {
    await getAllMeetings("user-1", "org-1", {
      sortBy: "title",
      sortOrder: "asc",
      page: 1,
      limit: 5,
    });

    expect(MeetingStorageService.getMeetingsQuery).toHaveBeenCalledWith(
      expect.any(Object),
      0,
      5,
      { title: 1 },
    );
  });

  it("falls back to createdAt desc for unknown sort fields", async () => {
    await getAllMeetings("user-1", "org-1", {
      sortBy: "not-a-field",
      sortOrder: "desc",
    });

    expect(MeetingStorageService.getMeetingsQuery).toHaveBeenCalledWith(
      expect.any(Object),
      0,
      10,
      { createdAt: -1 },
    );
  });
});
