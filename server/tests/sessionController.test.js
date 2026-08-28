import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock GenerativeAIService
vi.mock("../services/GenerativeAIService.js", () => ({
  generateSessionCardAI: vi.fn().mockResolvedValue({
    summary: "AI extracted keynote summary",
    keywords: ["AI", "Healthcare", "Innovation"],
  }),
}));

// Mock SessionCard model
const mockSessionCardStore = [];
let idCounter = 1;

vi.mock("../models/sessionCardModel.js", () => {
  const MockModel = {
    create: vi.fn(async (data) => {
      const created = {
        _id: `session-${idCounter++}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockSessionCardStore.push(created);
      return created;
    }),
    find: vi.fn((filter) => {
      let results = [...mockSessionCardStore];
      if (filter.organization) {
        results = results.filter(
          (s) => s.organization.toString() === filter.organization.toString(),
        );
      }
      if (filter.$or) {
        // Simple search mock
        results = results.filter((s) => {
          return filter.$or.some((condition) => {
            const field = Object.keys(condition)[0];
            const regex = condition[field];
            if (Array.isArray(s[field])) {
              return s[field].some((item) => regex.test(item));
            }
            return (
              regex && typeof s[field] === "string" && regex.test(s[field])
            );
          });
        });
      }
      return {
        sort: () => ({
          skip: (skipCount) => ({
            limit: (limitCount) => ({
              populate: () => ({
                lean: async () =>
                  results.slice(skipCount, skipCount + limitCount),
              }),
            }),
          }),
        }),
      };
    }),
    countDocuments: vi.fn(async (filter) => {
      let results = [...mockSessionCardStore];
      if (filter.organization) {
        results = results.filter(
          (s) => s.organization.toString() === filter.organization.toString(),
        );
      }
      return results.length;
    }),
    findOne: vi.fn((filter) => ({
      populate: () => ({
        lean: async () =>
          mockSessionCardStore.find(
            (s) =>
              s._id === filter._id &&
              s.organization.toString() === filter.organization.toString(),
          ) || null,
      }),
      save: async function () {
        return this;
      },
    })),
    findOneAndDelete: vi.fn(async (filter) => {
      const idx = mockSessionCardStore.findIndex(
        (s) =>
          s._id === filter._id &&
          s.organization.toString() === filter.organization.toString(),
      );
      if (idx !== -1) {
        const removed = mockSessionCardStore.splice(idx, 1)[0];
        return removed;
      }
      return null;
    }),
  };
  return { default: MockModel };
});

import {
  generateSession,
  getSessions,
  getSessionById,
  createSession,
  deleteSession,
} from "../controllers/sessionController.js";

describe("Session Controller Persistence & Org Library (#2257)", () => {
  beforeEach(() => {
    mockSessionCardStore.length = 0;
    idCounter = 1;
    vi.clearAllMocks();
  });

  it("generates session card and persists to SessionCard model with user org", async () => {
    const req = {
      body: {
        eventName: "TechSummit 2026",
        sessionTitle: "Scaling Node.js Microservices",
        speaker: "Jane Doe",
        speakerTitle: "Principal Engineer",
        speakerBio: "Expert in backend architecture",
      },
      user: {
        _id: "user-123",
        organization: "org-456",
      },
      files: {},
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await generateSession(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        session: expect.objectContaining({
          sessionTitle: "Scaling Node.js Microservices",
          eventName: "TechSummit 2026",
          speaker: "Jane Doe",
          summary: "AI extracted keynote summary",
          keywords: ["AI", "Healthcare", "Innovation"],
        }),
      }),
    );

    expect(mockSessionCardStore).toHaveLength(1);
    expect(mockSessionCardStore[0].organization).toBe("org-456");
  });

  it("lists saved session cards for the user's organization with pagination", async () => {
    mockSessionCardStore.push({
      _id: "session-1",
      organization: "org-456",
      sessionTitle: "Keynote 1",
      eventName: "Event A",
      speaker: "Speaker 1",
      keywords: ["AI"],
      createdAt: new Date(),
    });

    const req = {
      user: { organization: "org-456" },
      query: { page: "1", limit: "10" },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await getSessions(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        sessions: expect.arrayContaining([
          expect.objectContaining({ sessionTitle: "Keynote 1" }),
        ]),
        pagination: expect.objectContaining({
          total: 1,
          page: 1,
          limit: 10,
        }),
      }),
    );
  });

  it("retrieves a single session card by ID scoped to org", async () => {
    mockSessionCardStore.push({
      _id: "session-1",
      organization: "org-456",
      sessionTitle: "Deep Dive into ML",
      createdAt: new Date(),
    });

    const req = {
      user: { organization: "org-456" },
      params: { id: "session-1" },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await getSessionById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        session: expect.objectContaining({
          sessionTitle: "Deep Dive into ML",
        }),
      }),
    );
  });

  it("creates a manual session card", async () => {
    const req = {
      user: { _id: "user-1", organization: "org-456" },
      body: {
        sessionTitle: "Manual Architecture Review",
        eventName: "Internal Workshop",
        speaker: "John Smith",
        summary: "Discussion on system boundaries",
        keywords: ["Architecture", "Design"],
      },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await createSession(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        session: expect.objectContaining({
          sessionTitle: "Manual Architecture Review",
        }),
      }),
    );
  });

  it("deletes a session card scoped to organization", async () => {
    mockSessionCardStore.push({
      _id: "session-to-del",
      organization: "org-456",
      sessionTitle: "To Delete",
    });

    const req = {
      user: { organization: "org-456" },
      params: { id: "session-to-del" },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await deleteSession(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockSessionCardStore).toHaveLength(0);
  });
});
