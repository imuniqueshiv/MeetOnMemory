import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../models/userModel.js", () => ({ default: {} }));
vi.mock("../models/membershipModel.js", () => ({
  default: {
    find: vi.fn().mockReturnValue({
      populate: vi.fn().mockResolvedValue([]),
    }),
  },
}));
vi.mock("../models/actionItemModel.js", () => ({
  default: {
    find: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../models/meetingModel.js", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../models/notionIntegrationModel.js", () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock("../services/notionSyncService.js", () => ({
  createMeetingPage: vi.fn(),
}));

import NotionIntegration from "../models/notionIntegrationModel.js";
import Meeting from "../models/meetingModel.js";
import * as notionSync from "../services/notionSyncService.js";
import {
  getSyncHistory,
  syncMeeting,
} from "../controllers/notionIntegrationController.js";

describe("Notion Sync History & Retry Controller — #1602", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated sync history for organization", async () => {
    const mockIntegration = {
      organization: "org-123",
      syncHistory: [
        {
          _id: "log-1",
          meetingId: {
            _id: "m-1",
            title: "Board Sync",
            date: new Date(),
            meetingType: "board",
          },
          notionPageId: "p-1",
          notionPageUrl: "https://notion.so/p-1",
          status: "success",
          syncedAt: new Date(),
        },
      ],
    };

    const mockQuery = {
      populate: vi.fn().mockResolvedValue(mockIntegration),
    };
    NotionIntegration.findOne.mockReturnValue(mockQuery);

    const req = {
      user: { organization: "org-123" },
      query: { status: "all" },
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await getSyncHistory(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        total: 1,
        history: expect.arrayContaining([
          expect.objectContaining({
            meetingTitle: "Board Sync",
            status: "success",
          }),
        ]),
      }),
    );
  });

  it("triggers syncMeeting with force flag for retry", async () => {
    const mockMeeting = {
      _id: "m-1",
      organization: "org-123",
    };
    Meeting.findById.mockResolvedValue(mockMeeting);

    const mockIntegration = {
      organization: "org-123",
      targetDatabaseId: "db-123",
    };
    NotionIntegration.findOne.mockResolvedValue(mockIntegration);

    notionSync.createMeetingPage.mockResolvedValue({
      pageId: "page-new",
      pageUrl: "https://notion.so/page-new",
      alreadySynced: false,
    });

    const req = {
      user: { organization: "org-123" },
      body: { meetingId: "m-1", force: true },
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await syncMeeting(req, res);

    expect(notionSync.createMeetingPage).toHaveBeenCalledWith(
      mockMeeting,
      mockIntegration,
      expect.any(Array),
      true,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
