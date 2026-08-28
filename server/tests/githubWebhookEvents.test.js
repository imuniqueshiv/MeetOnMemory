import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockWebhookFind = jest.fn();
const mockIntegrationFindOne = jest.fn();

jest.unstable_mockModule("../models/webhookDeliveryLogModel.js", () => ({
  default: {
    find: (...args) => mockWebhookFind(...args),
  },
}));

jest.unstable_mockModule("../models/githubIntegrationModel.js", () => ({
  default: {
    findOne: (...args) => mockIntegrationFindOne(...args),
  },
}));

jest.unstable_mockModule("../models/actionItemModel.js", () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule("../services/githubSyncService.js", () => ({
  syncActionItemToGitHub: jest.fn(),
  handleGitHubIssueEvent: jest.fn(),
}));

const { getWebhookEvents, getRepositories } =
  await import("../controllers/githubIntegrationController.js");

describe("GitHub Integration Webhook Events and Repo Listing (#2237)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retrieves recent webhook delivery events for github provider", async () => {
    const mockEvents = [
      {
        deliveryId: "del_123",
        provider: "github",
        event: "issues",
        action: "opened",
        createdAt: new Date(),
      },
    ];

    mockWebhookFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockEvents),
        }),
      }),
    });

    const req = { params: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await getWebhookEvents(req, res);

    expect(mockWebhookFind).toHaveBeenCalledWith({ provider: "github" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        events: mockEvents,
      }),
    );
  });

  it("returns fallback configured repository when token is not present", async () => {
    mockIntegrationFindOne.mockResolvedValue({
      organization: "org_1",
      repositoryFullName: "acme/repo-main",
    });

    const req = { params: { organizationId: "org_1" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await getRepositories(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        repositories: [],
      }),
    );
  });
});
