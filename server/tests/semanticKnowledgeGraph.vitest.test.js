import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../models/meetingModel.js", () => {
  const MockMeeting = {
    findOne: vi.fn(),
    find: vi.fn(),
  };
  return { default: MockMeeting };
});

const { extractSemanticGraphFromMeeting, getSemanticNeighborhood } =
  await import("../controllers/semanticKnowledgeGraphController.js");
const Meeting = (await import("../models/meetingModel.js")).default;

const ORG_ID = "507f1f77bcf86cd799439099";
const OTHER_ORG_ID = "507f1f77bcf86cd799439077";
const MEETING_ID = "507f1f77bcf86cd799439012";

const meetingFixture = (overrides = {}) => ({
  _id: MEETING_ID,
  title: "Kickoff",
  organization: ORG_ID,
  decisions: [{ text: "Adopt Vite" }],
  actionItems: [
    {
      title: "Migrate build",
      status: "open",
      assignee: { _id: "507f1f77bcf86cd799439055", name: "Alice" },
    },
  ],
  tags: ["frontend"],
  ...overrides,
});

/** `findOne(...).populate(...).lean()` */
const mockFindOne = (meeting) => {
  Meeting.findOne.mockReturnValue({
    populate: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(meeting),
    }),
  });
};

/** `find(...).limit(...).populate(...).lean()` */
const mockFind = (meetings) => {
  Meeting.find.mockReturnValue({
    limit: vi.fn().mockReturnValue({
      populate: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(meetings),
      }),
    }),
  });
};

describe("semanticKnowledgeGraphController (#2446)", () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      user: { _id: "507f1f77bcf86cd799439011", organization: ORG_ID },
      params: {},
      query: {},
      headers: {},
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe("extractSemanticGraphFromMeeting", () => {
    it("returns the entity-relation graph for a meeting in the caller's organization", async () => {
      req.params.meetingId = MEETING_ID;
      mockFindOne(meetingFixture());

      await extractSemanticGraphFromMeeting(req, res);

      expect(Meeting.findOne).toHaveBeenCalledWith({
        _id: MEETING_ID,
        organization: ORG_ID,
      });
      expect(res.status).toHaveBeenCalledWith(200);

      const { graph } = res.json.mock.calls[0][0];
      expect(graph.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "MEETING", label: "Kickoff" }),
          expect.objectContaining({ type: "DECISION", label: "Adopt Vite" }),
          expect.objectContaining({
            type: "ACTION_ITEM",
            label: "Migrate build",
          }),
          expect.objectContaining({ type: "PERSON", label: "Alice" }),
          expect.objectContaining({ type: "TOPIC", label: "frontend" }),
        ]),
      );
      expect(graph.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ relation: "DECIDED_IN" }),
          expect.objectContaining({ relation: "DERIVED_FROM" }),
          expect.objectContaining({ relation: "OWNED_BY" }),
          expect.objectContaining({ relation: "DISCUSSED_TOPIC" }),
        ]),
      );
    });

    it("resolves a populated organization reference", async () => {
      req.user.organization = { _id: ORG_ID, name: "Acme" };
      req.params.meetingId = MEETING_ID;
      mockFindOne(meetingFixture());

      await extractSemanticGraphFromMeeting(req, res);

      expect(Meeting.findOne).toHaveBeenCalledWith({
        _id: MEETING_ID,
        organization: ORG_ID,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("ignores a client-supplied organization header", async () => {
      req.headers["x-organization-id"] = OTHER_ORG_ID;
      req.params.meetingId = MEETING_ID;
      mockFindOne(meetingFixture());

      await extractSemanticGraphFromMeeting(req, res);

      expect(Meeting.findOne).toHaveBeenCalledWith({
        _id: MEETING_ID,
        organization: ORG_ID,
      });
    });

    it("returns 404 when the meeting is outside the caller's organization", async () => {
      req.params.meetingId = MEETING_ID;
      mockFindOne(null);

      await extractSemanticGraphFromMeeting(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Meeting not found" });
    });

    it("returns 400 when the session has no organization", async () => {
      req.user.organization = null;
      req.params.meetingId = MEETING_ID;
      req.headers["x-organization-id"] = OTHER_ORG_ID;

      await extractSemanticGraphFromMeeting(req, res);

      expect(Meeting.findOne).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Organization context is required for semantic graph queries",
      });
    });
  });

  describe("getSemanticNeighborhood", () => {
    it("expands the k-hop neighborhood across the organization's meetings", async () => {
      req.query = { seedNodeId: "person-507f1f77bcf86cd799439055", kHops: "2" };
      mockFind([meetingFixture()]);

      await getSemanticNeighborhood(req, res);

      expect(Meeting.find).toHaveBeenCalledWith({ organization: ORG_ID });
      expect(res.status).toHaveBeenCalledWith(200);

      const { nodes, edges } = res.json.mock.calls[0][0];
      expect(nodes.map((node) => node.id)).toEqual(
        expect.arrayContaining([
          "person-507f1f77bcf86cd799439055",
          `action-${MEETING_ID}-0`,
          `meeting-${MEETING_ID}`,
        ]),
      );
      expect(edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ relation: "OWNED_BY" }),
          expect.objectContaining({ relation: "DERIVED_FROM" }),
        ]),
      );
    });

    it("keeps a single hop from reaching second-degree entities", async () => {
      req.query = { seedNodeId: "person-507f1f77bcf86cd799439055", kHops: "1" };
      mockFind([meetingFixture()]);

      await getSemanticNeighborhood(req, res);

      const { nodes } = res.json.mock.calls[0][0];
      expect(nodes.map((node) => node.id)).toEqual([
        `action-${MEETING_ID}-0`,
        "person-507f1f77bcf86cd799439055",
      ]);
    });

    it("returns 400 without a seed node", async () => {
      req.query = {};

      await getSemanticNeighborhood(req, res);

      expect(Meeting.find).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "seedNodeId query parameter is required",
      });
    });

    it("returns 400 when the session has no organization", async () => {
      req.user = {};
      req.query = { seedNodeId: "topic-frontend" };

      await getSemanticNeighborhood(req, res);

      expect(Meeting.find).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Organization context is required for semantic graph queries",
      });
    });
  });
});
