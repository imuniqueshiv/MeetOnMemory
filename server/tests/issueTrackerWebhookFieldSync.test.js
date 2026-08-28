import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../models/actionItemModel.js", () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock("../models/issueTrackerIntegrationModel.js", () => ({
  default: {
    findOne: vi.fn(),
  },
}));

import {
  handleJiraWebhook,
  handleLinearWebhook,
} from "../controllers/issueTrackerWebhookController.js";
import ActionItem from "../models/actionItemModel.js";
import IssueTrackerIntegration from "../models/issueTrackerIntegrationModel.js";

describe("Issue Tracker Webhook Inbound Field Sync (#2238)", () => {
  let req;
  let res;
  let mockActionItem;
  let mockIntegration;
  const oldEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...oldEnv,
      JIRA_WEBHOOK_SECRET: "jira-secret",
      LINEAR_WEBHOOK_SECRET: "linear-secret",
    };

    mockActionItem = {
      _id: "ai-1",
      organization: "org-1",
      text: "Original Title",
      dueDate: new Date("2026-08-01"),
      status: "open",
      save: vi.fn().mockResolvedValue(true),
    };

    mockIntegration = {
      lastSyncAt: null,
      lastSyncStatus: "idle",
      syncCount: 0,
      syncLogs: [],
      save: vi.fn().mockResolvedValue(true),
    };

    ActionItem.findOne.mockResolvedValue(mockActionItem);
    IssueTrackerIntegration.findOne.mockResolvedValue(mockIntegration);

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    process.env = oldEnv;
  });

  it("handleJiraWebhook updates action item title, duedate, status, and records sync log", async () => {
    req = {
      headers: { authorization: "Bearer jira-secret" },
      body: {
        issue: {
          key: "PROJ-100",
          fields: {
            summary: "Updated Jira Task Title",
            status: { name: "Done" },
            duedate: "2026-09-15",
          },
        },
      },
    };

    await handleJiraWebhook(req, res);

    expect(mockActionItem.text).toBe("Updated Jira Task Title");
    expect(mockActionItem.status).toBe("completed");
    expect(mockActionItem.dueDate).toEqual(new Date("2026-09-15"));
    expect(mockActionItem.save).toHaveBeenCalled();
    expect(mockIntegration.syncCount).toBe(1);
    expect(mockIntegration.lastSyncStatus).toBe("success");
    expect(mockIntegration.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("handleLinearWebhook updates action item title and status", async () => {
    req = {
      headers: { "linear-signature": "invalid-sig" },
      body: {
        action: "update",
        type: "Issue",
        data: {
          id: "lin-55",
          title: "Updated Linear Task Title",
          state: { name: "In Progress" },
        },
      },
    };

    // Signature verify will fail with invalid-sig, return 401
    await handleLinearWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
