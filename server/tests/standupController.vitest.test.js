import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../models/actionItemModel.js", () => {
  const mockActionItem = {
    find: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue([
      {
        text: "Fix auth flow",
        status: "completed",
        completedAt: new Date(),
        assignee: "user-1",
      },
      {
        text: "Design dashboard",
        status: "in-progress",
        assignee: "user-1",
      },
    ]),
  };
  return { default: mockActionItem };
});

const { getStandupReport, createStandupReport } =
  await import("../controllers/standupController.js");

describe("standupController (#2656)", () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      query: {},
      body: {},
      user: {
        _id: "user-1",
        id: "user-1",
        organization: "org-123",
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it("returns categorized standup report via getStandupReport", async () => {
    req.query = { range: "yesterday", scope: "personal" };

    await getStandupReport(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        range: "yesterday",
        scope: "personal",
        standup: expect.objectContaining({
          done: expect.any(Array),
          inProgress: expect.any(Array),
        }),
        markdown: expect.any(String),
      }),
    );
  });

  it("compiles unified standup summary report via createStandupReport", async () => {
    req.body = { teamId: "TEAM-BETA", summaryData: true };

    await createStandupReport(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "TEAM-BETA",
        summaryData: true,
        generatedAt: expect.any(String),
      }),
    );
  });
});
