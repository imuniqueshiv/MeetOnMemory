import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchVectorStore } from "../utils/embeddingUtils.js";

// Mock Pinecone index query results
const mockQuery = vi.fn();
vi.mock("../utils/embeddingUtils.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    initVectorStore: vi.fn().mockResolvedValue({
      query: mockQuery,
    }),
    embedText: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
  };
});

describe("Vector Search Organization-Level Filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws an error if organization context is missing", async () => {
    await expect(searchVectorStore("some query")).rejects.toThrow(
      "Organization context is required for vector search",
    );

    await expect(searchVectorStore("some query", {})).rejects.toThrow(
      "Organization context is required for vector search",
    );

    await expect(searchVectorStore("some query", { limit: 5 })).rejects.toThrow(
      "Organization context is required for vector search",
    );
  });

  it("applies eq filter for single organization context and filters results", async () => {
    mockQuery.mockResolvedValue({
      matches: [
        {
          id: "meeting-1",
          score: 0.9,
          metadata: {
            meetingId: "meeting-1",
            title: "Org A Standup",
            organization: "org-A",
          },
        },
        {
          id: "meeting-2",
          score: 0.8,
          metadata: {
            meetingId: "meeting-2",
            title: "Org B Sync",
            organization: "org-B",
          },
        },
      ],
    });

    const results = await searchVectorStore("sync", {
      organization: "org-A",
    });

    // Verify Pinecone was queried with correct organization eq metadata filter
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: {
          organization: { $eq: "org-A" },
        },
      }),
    );

    // Verify cross-organization matches are excluded in post-query filtering
    expect(results).toHaveLength(1);
    expect(results[0].meetingId).toBe("meeting-1");
  });

  it("applies in filter for array of organization contexts and filters results", async () => {
    mockQuery.mockResolvedValue({
      matches: [
        {
          id: "meeting-1",
          score: 0.9,
          metadata: {
            meetingId: "meeting-1",
            title: "Org A Standup",
            organization: "org-A",
          },
        },
        {
          id: "meeting-2",
          score: 0.8,
          metadata: {
            meetingId: "meeting-2",
            title: "Org B Sync",
            organization: "org-B",
          },
        },
        {
          id: "meeting-3",
          score: 0.7,
          metadata: {
            meetingId: "meeting-3",
            title: "Org C Retrospective",
            organization: "org-C",
          },
        },
      ],
    });

    const results = await searchVectorStore("sync", {
      organization: ["org-A", "org-B"],
    });

    // Verify Pinecone was queried with correct organization in metadata filter
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: {
          organization: { $in: ["org-A", "org-B"] },
        },
      }),
    );

    // Verify cross-organization matches are excluded
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.meetingId)).toContain("meeting-1");
    expect(results.map((r) => r.meetingId)).toContain("meeting-2");
    expect(results.map((r) => r.meetingId)).not.toContain("meeting-3");
  });
});
