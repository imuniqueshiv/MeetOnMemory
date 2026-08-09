import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "./apiClient";
import { getAllDecisionGraphPages } from "./decisionGraphApi";

vi.mock("./apiClient", () => ({
  default: {
    get: vi.fn(),
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
