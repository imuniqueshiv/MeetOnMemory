import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../models/issueTrackerIntegrationModel.js", () => {
  const mockIntegration = {
    organization: "org-1",
    provider: "jira",
    accessToken: "secret-token",
    config: { siteUrl: "https://myorg.atlassian.net", projectKey: "PROJ" },
    lastSyncStatus: "idle",
    syncCount: 5,
    syncLogs: [],
    toObject: function () {
      return {
        organization: this.organization,
        provider: this.provider,
        accessToken: this.accessToken,
        config: this.config,
        lastSyncStatus: this.lastSyncStatus,
        syncCount: this.syncCount,
        syncLogs: this.syncLogs,
      };
    },
    save: vi.fn().mockResolvedValue(true),
  };

  return {
    default: {
      findOne: vi.fn().mockResolvedValue(mockIntegration),
      create: vi.fn().mockImplementation((data) =>
        Promise.resolve({
          ...data,
          toObject: () => data,
          save: vi.fn().mockResolvedValue(true),
        }),
      ),
      findOneAndDelete: vi.fn().mockResolvedValue(true),
    },
  };
});

import {
  getConfig,
  updateConfig,
  getSyncStatus,
  disconnect,
} from "../controllers/issueTrackerController.js";
import IssueTrackerIntegration from "../models/issueTrackerIntegrationModel.js";

describe("Issue Tracker Controller (#2238)", () => {
  let req;
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      params: { provider: "jira" },
      user: { organization: "org-1", id: "user-1" },
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  it("getConfig returns safe data without access tokens", async () => {
    await getConfig(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          provider: "jira",
          config: expect.objectContaining({ projectKey: "PROJ" }),
        }),
      }),
    );
    expect(res.json.mock.calls[0][0].data.accessToken).toBeUndefined();
  });

  it("updateConfig validates Jira siteUrl protocol", async () => {
    req.body = {
      config: { siteUrl: "ftp://invalid-url.com" },
    };

    await updateConfig(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Invalid site URL protocol",
      }),
    );
  });

  it("updateConfig updates configuration, field mappings, and appends sync log", async () => {
    req.body = {
      config: {
        siteUrl: "https://myorg.atlassian.net",
        projectKey: "NEWPROJ",
        fieldMappings: { syncAssignee: true, syncDueDate: true },
        statusMappings: { open: "To Do", completed: "Done" },
      },
    };

    await updateConfig(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      }),
    );
  });

  it("getSyncStatus returns sync metrics and history logs", async () => {
    await getSyncStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          connected: true,
          syncCount: 5,
          lastSyncStatus: "idle",
        }),
      }),
    );
  });

  it("disconnect deletes integration", async () => {
    await disconnect(req, res);

    expect(IssueTrackerIntegration.findOneAndDelete).toHaveBeenCalledWith({
      organization: "org-1",
      provider: "jira",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Disconnected successfully",
      }),
    );
  });
});
