import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "../apiClient";
import {
  extractMeetingSemanticGraph,
  getSemanticNeighborhood,
} from "../semanticGraphApi";

vi.mock("../apiClient", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("semanticGraphApi (#2446)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractMeetingSemanticGraph", () => {
    it("requests the meeting extract endpoint and unwraps the graph", async () => {
      const graph = {
        nodes: [{ id: "meeting-m-1", label: "Kickoff", type: "MEETING" }],
        edges: [
          {
            source: "decision-m-1-0",
            target: "meeting-m-1",
            relation: "DECIDED_IN",
          },
        ],
      };
      apiClient.get.mockResolvedValueOnce({ data: { graph } });

      const result = await extractMeetingSemanticGraph("m-1");

      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/semantic-graph/meeting/m-1",
      );
      expect(result).toEqual(graph);
    });

    it("returns an empty graph for a malformed payload", async () => {
      apiClient.get.mockResolvedValueOnce({ data: {} });

      await expect(extractMeetingSemanticGraph("m-1")).resolves.toEqual({
        nodes: [],
        edges: [],
      });
    });

    it("does not call the API without a meeting id", async () => {
      await expect(extractMeetingSemanticGraph("")).resolves.toEqual({
        nodes: [],
        edges: [],
      });
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("propagates API errors", async () => {
      const error = new Error("Meeting not found");
      apiClient.get.mockRejectedValueOnce(error);

      await expect(extractMeetingSemanticGraph("m-1")).rejects.toThrow(
        "Meeting not found",
      );
    });
  });

  describe("getSemanticNeighborhood", () => {
    it("requests the neighborhood endpoint with the seed and hop count", async () => {
      const neighborhood = {
        nodes: [{ id: "person-u-1", label: "Alice", type: "PERSON" }],
        edges: [],
      };
      apiClient.get.mockResolvedValueOnce({ data: neighborhood });

      const result = await getSemanticNeighborhood("person-u-1", 2);

      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/semantic-graph/neighborhood",
        { params: { seedNodeId: "person-u-1", kHops: 2 } },
      );
      expect(result).toEqual(neighborhood);
    });

    it("defaults to a single hop", async () => {
      apiClient.get.mockResolvedValueOnce({ data: { nodes: [], edges: [] } });

      await getSemanticNeighborhood("topic-budget");

      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/semantic-graph/neighborhood",
        { params: { seedNodeId: "topic-budget", kHops: 1 } },
      );
    });

    it("does not call the API without a seed node", async () => {
      await expect(getSemanticNeighborhood("")).resolves.toEqual({
        nodes: [],
        edges: [],
      });
      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });
});
