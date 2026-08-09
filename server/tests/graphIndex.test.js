import mongoose from "mongoose";
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import {
  buildGraph,
  expandFromSeeds,
  nodeKey,
  NODE_TYPES,
} from "../graph/graphIndex.js";

async function makeMeeting(overrides = {}) {
  const owner = await User.create({
    name: "Owner",
    email: `owner-${new mongoose.Types.ObjectId()}@example.com`,
    password: "hashedpw123",
  });

  return Meeting.create({
    title: "Q3 Planning",
    transcript: "We discussed the roadmap.",
    uploadedBy: owner._id,
    date: new Date(),
    ...overrides,
  });
}

describe("graph/graphIndex", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  });
  describe("buildGraph", () => {
    it("links decisions to each other via relatesTo edges", async () => {
      const meeting = await makeMeeting();

      const decisionA = await Decision.create({
        text: "Adopt hybrid retrieval",
        sourceMeetingId: meeting._id,
        embedding: [1, 0, 0],
      });
      const decisionB = await Decision.create({
        text: "Adopt hybrid retrieval (follow-up)",
        sourceMeetingId: meeting._id,
        embedding: [0.9, 0.1, 0],
        relatesTo: [{ target: decisionA._id, confidence: 90 }],
      });

      const graph = await buildGraph(null);

      const keyA = nodeKey(NODE_TYPES.DECISION, decisionA._id);
      const keyB = nodeKey(NODE_TYPES.DECISION, decisionB._id);

      expect(graph.nodes.has(keyA)).toBe(true);
      expect(graph.nodes.has(keyB)).toBe(true);

      const neighborsOfA = graph.adjacency.get(keyA).map((e) => e.key);
      expect(neighborsOfA).toContain(keyB);
    });

    it("links a decision and an action item that share a meeting", async () => {
      const meeting = await makeMeeting();

      const decision = await Decision.create({
        text: "Ship v2",
        sourceMeetingId: meeting._id,
      });
      const actionItem = await ActionItem.create({
        text: "Write migration guide",
        sourceMeetingId: meeting._id,
      });

      const graph = await buildGraph(null);

      const meetingKey = nodeKey(NODE_TYPES.MEETING, meeting._id);
      const decisionKey = nodeKey(NODE_TYPES.DECISION, decision._id);
      const actionItemKey = nodeKey(NODE_TYPES.ACTION_ITEM, actionItem._id);

      expect(graph.adjacency.get(meetingKey).map((e) => e.key)).toEqual(
        expect.arrayContaining([decisionKey, actionItemKey]),
      );
    });

    it("scopes nodes to the given organization", async () => {
      const orgA = new mongoose.Types.ObjectId();
      const orgB = new mongoose.Types.ObjectId();
      const meeting = await makeMeeting();

      await Decision.create({
        text: "Org A decision",
        sourceMeetingId: meeting._id,
        organization: orgA,
      });
      await Decision.create({
        text: "Org B decision",
        sourceMeetingId: meeting._id,
        organization: orgB,
      });

      const graphA = await buildGraph(orgA);
      const decisionTexts = Array.from(graphA.nodes.values())
        .filter((n) => n.type === NODE_TYPES.DECISION)
        .map((n) => n.text);

      expect(decisionTexts).toEqual(["Org A decision"]);
    });
  });

  describe("expandFromSeeds", () => {
    it("performs multi-hop traversal and decays score with distance", async () => {
      const meeting = await makeMeeting();

      const d1 = await Decision.create({
        text: "D1",
        sourceMeetingId: meeting._id,
      });
      const d2 = await Decision.create({
        text: "D2",
        sourceMeetingId: meeting._id,
        relatesTo: [{ target: d1._id, confidence: 100 }],
      });
      const d3 = await Decision.create({
        text: "D3",
        sourceMeetingId: meeting._id,
        relatesTo: [{ target: d2._id, confidence: 100 }],
      });
      // Re-save d1/d2 so the reverse edges recorded above are queryable
      // (relatesTo is one-directional in storage; buildGraph makes it
      // undirected for traversal, so this isn't strictly needed, but keeps
      // the fixture explicit about what's stored vs. derived.)

      const graph = await buildGraph(null);
      const seedKey = nodeKey(NODE_TYPES.DECISION, d1._id);

      const hop1 = expandFromSeeds(graph, [seedKey], {
        maxHops: 1,
        decay: 0.6,
      });
      const hop2 = expandFromSeeds(graph, [seedKey], {
        maxHops: 2,
        decay: 0.6,
      });

      const keyD2 = nodeKey(NODE_TYPES.DECISION, d2._id);
      const keyD3 = nodeKey(NODE_TYPES.DECISION, d3._id);

      // With only 1 hop allowed, D3 (2 hops away) should not be reachable.
      expect(hop1.find((r) => r.key === keyD3)).toBeUndefined();
      expect(hop1.find((r) => r.key === keyD2)).toBeDefined();

      // With 2 hops allowed, D3 becomes reachable and scores lower than D2.
      const d2Result = hop2.find((r) => r.key === keyD2);
      const d3Result = hop2.find((r) => r.key === keyD3);
      expect(d2Result).toBeDefined();
      expect(d3Result).toBeDefined();
      expect(d3Result.graphScore).toBeLessThan(d2Result.graphScore);
      expect(d3Result.hops).toBe(2);
    });

    it("does not re-surface a seed node itself", async () => {
      const meeting = await makeMeeting();
      const d1 = await Decision.create({
        text: "D1",
        sourceMeetingId: meeting._id,
      });
      const d2 = await Decision.create({
        text: "D2",
        sourceMeetingId: meeting._id,
        relatesTo: [{ target: d1._id, confidence: 100 }],
      });

      const graph = await buildGraph(null);
      const seedKeys = [
        nodeKey(NODE_TYPES.DECISION, d1._id),
        nodeKey(NODE_TYPES.DECISION, d2._id),
      ];

      const expansions = expandFromSeeds(graph, seedKeys, { maxHops: 2 });
      expect(expansions.find((r) => seedKeys.includes(r.key))).toBeUndefined();
    });

    it("respects minEdgeWeight to ignore weak relationships", async () => {
      const meeting = await makeMeeting();
      const d1 = await Decision.create({
        text: "D1",
        sourceMeetingId: meeting._id,
      });
      const weak = await Decision.create({
        text: "Weak link",
        sourceMeetingId: meeting._id,
        relatesTo: [{ target: d1._id, confidence: 10 }],
      });

      const graph = await buildGraph(null);
      const seedKey = nodeKey(NODE_TYPES.DECISION, d1._id);
      const weakKey = nodeKey(NODE_TYPES.DECISION, weak._id);

      const withoutFilter = expandFromSeeds(graph, [seedKey], {
        maxHops: 1,
        minEdgeWeight: 0,
      });
      const withFilter = expandFromSeeds(graph, [seedKey], {
        maxHops: 1,
        minEdgeWeight: 50,
      });

      expect(withoutFilter.find((r) => r.key === weakKey)).toBeDefined();
      expect(withFilter.find((r) => r.key === weakKey)).toBeUndefined();
    });
  });
});
