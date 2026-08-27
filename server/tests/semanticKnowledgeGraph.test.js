import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const mockMeetingFindOne = jest.fn();
const mockMeetingFind = jest.fn();

jest.unstable_mockModule("../models/meetingModel.js", () => ({
  default: {
    findOne: (...args) => mockMeetingFindOne(...args),
    find: (...args) => mockMeetingFind(...args),
  },
}));

const { extractSemanticGraphFromMeeting, getSemanticNeighborhood } =
  await import("../controllers/semanticKnowledgeGraphController.js");

describe("Semantic Knowledge Graph Controller (#2446)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("extracts semantic graph entities and relations for a meeting", async () => {
    const mockMeeting = {
      _id: "m_1",
      title: "Sprint Planning",
      decisions: ["Adopt Redis caching"],
      actionItems: [
        {
          title: "Deploy Redis cluster",
          status: "pending",
          assignee: { _id: "u_1", name: "DevOps Lead" },
        },
      ],
      tags: ["Infrastructure", "Performance"],
    };

    mockMeetingFindOne.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockMeeting),
      }),
    });

    const req = {
      params: { meetingId: "m_1" },
      user: { organizationId: "org_1" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await extractSemanticGraphFromMeeting(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        graph: expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: "meeting-m_1", type: "MEETING" }),
            expect.objectContaining({ type: "DECISION" }),
            expect.objectContaining({ type: "ACTION_ITEM" }),
            expect.objectContaining({ type: "PERSON", label: "DevOps Lead" }),
          ]),
          edges: expect.arrayContaining([
            expect.objectContaining({ relation: "DECIDED_IN" }),
            expect.objectContaining({ relation: "OWNED_BY" }),
          ]),
        }),
      }),
    );
  });

  it("expands k-hop neighborhood from seed node ID", async () => {
    const mockMeeting = {
      _id: "m_1",
      title: "Architecture Review",
      decisions: ["Use Microservices"],
      actionItems: [],
      tags: [],
    };

    mockMeetingFind.mockReturnValue({
      limit: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([mockMeeting]),
        }),
      }),
    });

    const req = {
      query: { seedNodeId: "meeting-m_1", kHops: "1" },
      user: { organizationId: "org_1" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await getSemanticNeighborhood(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.any(Array),
        edges: expect.any(Array),
      }),
    );
  });
});
