import { jest } from "@jest/globals";
import mongoose from "mongoose";

// The real embeddingUtils module loads a Hugging Face transformer model and
// talks to Pinecone - neither is available/desired in unit tests. Mock it so
// hybridRetrievalService can be exercised against real Mongo documents
// (via mongodb-memory-server) without any network/model dependency.
const mockEmbedText = jest.fn();
const mockSearchVectorStore = jest.fn();

jest.unstable_mockModule("../utils/embeddingUtils.js", () => ({
  embedText: mockEmbedText,
  searchVectorStore: mockSearchVectorStore,
}));

const Decision = (await import("../models/decisionModel.js")).default;
const Meeting = (await import("../models/meetingModel.js")).default;
const User = (await import("../models/userModel.js")).default;
const { nodeKey, NODE_TYPES } = await import("../graph/graphIndex.js");
const { hybridRetrieve, resolveOptions, fuseResults } =
  await import("../services/hybridRetrievalService.js");

async function makeMeeting(overrides = {}) {
  const owner = await User.create({
    name: "Owner",
    email: `owner-${new mongoose.Types.ObjectId()}@example.com`,
    password: "hashedpw123",
  });

  return Meeting.create({
    title: "Chess Club Sync",
    transcript: "Alice mentioned she works at OpenAI and lives in Delhi.",
    uploadedBy: owner._id,
    date: new Date(),
    ...overrides,
  });
}

describe("hybridRetrievalService", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchVectorStore.mockResolvedValue([]); // no Pinecone in unit tests
  });

  describe("resolveOptions", () => {
    it("fills in sensible defaults", () => {
      const opts = resolveOptions({});
      expect(opts.topK).toBe(10);
      expect(opts.maxHops).toBe(2);
      expect(opts.semanticWeight + opts.graphWeight).toBeCloseTo(1);
    });

    it("normalizes arbitrary weight ratios to sum to 1", () => {
      const opts = resolveOptions({ semanticWeight: 2, graphWeight: 1 });
      expect(opts.semanticWeight).toBeCloseTo(2 / 3);
      expect(opts.graphWeight).toBeCloseTo(1 / 3);
    });

    it("clamps topK and maxHops to safe ranges", () => {
      const opts = resolveOptions({ topK: 1000, maxHops: 99 });
      expect(opts.topK).toBeLessThanOrEqual(50);
      expect(opts.maxHops).toBeLessThanOrEqual(4);
    });

    it("filters includeTypes to known values only", () => {
      const opts = resolveOptions({ includeTypes: ["decision", "bogus"] });
      expect(opts.includeTypes).toEqual(["decision"]);
    });
  });

  describe("hybridRetrieve", () => {
    it("throws on an empty query", async () => {
      await expect(hybridRetrieve("", null)).rejects.toThrow(
        "A non-empty query string is required",
      );
    });

    it("finds a semantically-matched decision and expands to its graph neighbor", async () => {
      const meeting = await makeMeeting();

      // Two related decisions: only "chessDecision" will match the query
      // semantically; "openaiDecision" is reachable only through the graph.
      const chessDecision = await Decision.create({
        text: "Alice likes chess",
        sourceMeetingId: meeting._id,
        embedding: [1, 0, 0],
      });
      const openaiDecision = await Decision.create({
        text: "Alice works at OpenAI",
        sourceMeetingId: meeting._id,
        embedding: [0, 1, 0], // deliberately dissimilar to the query embedding
        relatesTo: [{ target: chessDecision._id, confidence: 95 }],
      });

      // Query embedding points directly at the chess decision's vector.
      mockEmbedText.mockResolvedValue([1, 0, 0]);

      const { results, meta } = await hybridRetrieve(
        "Where does the person who likes chess work?",
        null,
        { maxHops: 2, includeTypes: ["decision"] },
      );

      const chessKey = nodeKey(NODE_TYPES.DECISION, chessDecision._id);
      const openaiKey = nodeKey(NODE_TYPES.DECISION, openaiDecision._id);

      const chessResult = results.find((r) => r.key === chessKey);
      const openaiResult = results.find((r) => r.key === openaiKey);

      expect(chessResult).toBeDefined();
      expect(chessResult.semanticScore).toBeCloseTo(1);

      // The OpenAI decision should surface purely through graph expansion.
      expect(openaiResult).toBeDefined();
      expect(openaiResult.semanticScore).toBe(0);
      expect(openaiResult.graphScore).toBeGreaterThan(0);
      expect(openaiResult.hops).toBe(1);

      expect(meta.semanticHitCount).toBeGreaterThan(0);
      expect(meta.graphExpansionCount).toBeGreaterThan(0);
    });

    it("respects organization scoping", async () => {
      const orgA = new mongoose.Types.ObjectId();
      const orgB = new mongoose.Types.ObjectId();
      const meeting = await makeMeeting();

      await Decision.create({
        text: "Org A only decision",
        sourceMeetingId: meeting._id,
        organization: orgA,
        embedding: [1, 0, 0],
      });
      await Decision.create({
        text: "Org B only decision",
        sourceMeetingId: meeting._id,
        organization: orgB,
        embedding: [1, 0, 0],
      });

      mockEmbedText.mockResolvedValue([1, 0, 0]);

      const { results } = await hybridRetrieve("decision", orgA, {
        includeTypes: ["decision"],
      });

      expect(results.every((r) => r.title !== "Org B only decision")).toBe(
        true,
      );
      expect(results.some((r) => r.title === "Org A only decision")).toBe(true);
    });

    it("degrades gracefully when the vector store throws", async () => {
      mockSearchVectorStore.mockRejectedValue(
        new Error("Pinecone unreachable"),
      );
      mockEmbedText.mockResolvedValue([1, 0, 0]);

      const meeting = await makeMeeting();
      await Decision.create({
        text: "Still findable via decision embeddings",
        sourceMeetingId: meeting._id,
        embedding: [1, 0, 0],
      });

      const { results } = await hybridRetrieve("query", null, {
        includeTypes: ["meeting", "decision"],
      });

      expect(
        results.some(
          (r) => r.title === "Still findable via decision embeddings",
        ),
      ).toBe(true);
    });

    it("higher graphWeight favors graph-connected results over weakly-matching semantic ones", async () => {
      const meeting = await makeMeeting();

      const seed = await Decision.create({
        text: "Seed decision",
        sourceMeetingId: meeting._id,
        embedding: [1, 0, 0],
      });
      const strongGraphNeighbor = await Decision.create({
        text: "Strongly linked neighbor",
        sourceMeetingId: meeting._id,
        embedding: [0, 1, 0],
        relatesTo: [{ target: seed._id, confidence: 100 }],
      });
      const weakSemanticOnly = await Decision.create({
        text: "Weak semantic-only match",
        sourceMeetingId: meeting._id,
        embedding: [0.15, 0.98, 0],
      });

      mockEmbedText.mockResolvedValue([1, 0, 0]);

      const { results } = await hybridRetrieve("seed decision", null, {
        includeTypes: ["decision"],
        semanticWeight: 0.1,
        graphWeight: 0.9,
        maxHops: 1,
      });

      const neighborKey = nodeKey(NODE_TYPES.DECISION, strongGraphNeighbor._id);
      const weakKey = nodeKey(NODE_TYPES.DECISION, weakSemanticOnly._id);

      const neighborRank = results.findIndex((r) => r.key === neighborKey);
      const weakRank = results.findIndex((r) => r.key === weakKey);

      expect(neighborRank).toBeGreaterThanOrEqual(0);
      expect(weakRank).toBeGreaterThanOrEqual(0);
      expect(neighborRank).toBeLessThan(weakRank);
    });
  });

  describe("fuseResults", () => {
    it("keeps the best graph score when a node is reached via multiple paths", () => {
      const fused = fuseResults(
        [],
        [
          {
            key: "decision:1",
            node: { type: "decision", id: "1", text: "D1" },
            hops: 1,
            graphScore: 0.3,
            path: [],
          },
          {
            key: "decision:1",
            node: { type: "decision", id: "1", text: "D1" },
            hops: 2,
            graphScore: 0.7,
            path: [],
          },
        ],
        { semanticWeight: 0.7, graphWeight: 0.3 },
      );
      expect(fused[0].graphScore).toBe(0.7);
    });
  });
});
