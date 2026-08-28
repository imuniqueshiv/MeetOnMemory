import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "./apiClient";
import {
  getAllDecisionGraphPages,
  createDecision,
  linkDecisions,
  supersedeDecision,
} from "./decisionGraphApi";

vi.mock("./apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("getAllDecisionGraphPages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("collects every page and removes duplicate nodes and edges", async () => {
    apiClient.get
      .mockResolvedValueOnce({
        data: {
          nodes: [{ id: "decision-1" }, { id: "decision-2" }],
          edges: [
            {
              source: "decision-1",
              target: "decision-2",
              type: "relatesTo",
              confidence: 100,
            },
          ],
          pagination: { page: 1, hasMore: true },
        },
      })
      .mockResolvedValueOnce({
        data: {
          nodes: [{ id: "decision-2" }, { id: "decision-3" }],
          edges: [
            {
              source: "decision-1",
              target: "decision-2",
              type: "relatesTo",
              confidence: 100,
            },
          ],
          pagination: { page: 2, hasMore: false },
        },
      });

    const graph = await getAllDecisionGraphPages();

    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/api/decision-graph", {
      params: { page: 1, limit: 200 },
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/api/decision-graph", {
      params: { page: 2, limit: 200 },
    });
    expect(graph.nodes).toEqual([
      { id: "decision-1" },
      { id: "decision-2" },
      { id: "decision-3" },
    ]);
    expect(graph.edges).toHaveLength(1);
  });

  it("returns available graph data when optional response fields are missing", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        nodes: [{ id: "decision-1" }],
      },
    });

    const graph = await getAllDecisionGraphPages();

    expect(graph).toEqual({
      nodes: [{ id: "decision-1" }],
      edges: [],
      pagination: undefined,
    });
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it("preserves distinct edges when IDs contain colons", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        edges: [
          { source: "decision:one", target: "two", type: "relatesTo" },
          { source: "decision", target: "one:two", type: "relatesTo" },
        ],
      },
    });

    const graph = await getAllDecisionGraphPages();

    expect(graph.edges).toHaveLength(2);
  });
});

describe("decision graph mutations (Issue #2027)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createDecision posts the decision payload", async () => {
    apiClient.post.mockResolvedValueOnce({ data: { decision: { id: "d1" } } });
    const out = await createDecision({
      text: "Adopt Rust for the parser",
      owner: "alice",
      status: "open",
      sourceMeetingId: "m1",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/api/decision-graph", {
      text: "Adopt Rust for the parser",
      owner: "alice",
      status: "open",
      sourceMeetingId: "m1",
    });
    expect(out.decision.id).toBe("d1");
  });

  it("linkDecisions posts a relatesTo edge to the right id", async () => {
    apiClient.post.mockResolvedValueOnce({
      data: { edge: { type: "relatesTo" } },
    });
    await linkDecisions("d1", { targetId: "d2", confidence: 80 });
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/decision-graph/d1/relations",
      {
        targetId: "d2",
        confidence: 80,
      },
    );
  });

  it("supersedeDecision posts to the supersede endpoint", async () => {
    apiClient.post.mockResolvedValueOnce({ data: { status: "superseded" } });
    const out = await supersedeDecision("d1", { targetId: "d2" });
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/decision-graph/d1/supersede",
      {
        targetId: "d2",
      },
    );
    expect(out.status).toBe("superseded");
  });
});
