import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {};
    }),
  };
});

vi.mock("../utils/embeddingUtils.js", () => ({
  searchVectorStore: vi.fn(),
  indexTranscript: vi.fn(),
  indexMeeting: vi.fn(),
}));

import { voiceSearch } from "../controllers/transcriptController.js";
import * as embeddingUtils from "../utils/embeddingUtils.js";

describe("Voice Search Tenant Isolation (#805)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fail closed and exclude records missing organization", async () => {
    const mockResults = [
      { id: "1", title: "Org A Meeting", organization: "org-123" },
      { id: "2", title: "Unscoped Meeting", organization: null },
      { id: "3", title: "Undefined Org Meeting" },
    ];

    vi.spyOn(embeddingUtils, "searchVectorStore").mockResolvedValue(
      mockResults,
    );

    const req = {
      query: { query: "search terms" },
      user: { id: "user-1", organization: "org-123" },
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await voiceSearch(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        results: [{ id: "1", title: "Org A Meeting", organization: "org-123" }],
      }),
    );
  });

  it("should exclude records belonging to a different organization", async () => {
    const mockResults = [
      { id: "1", title: "Org A Meeting", organization: "org-123" },
      { id: "2", title: "Org B Meeting", organization: "org-456" },
    ];

    vi.spyOn(embeddingUtils, "searchVectorStore").mockResolvedValue(
      mockResults,
    );

    const req = {
      query: { query: "search terms" },
      user: { id: "user-1", organization: "org-123" },
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await voiceSearch(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        results: [{ id: "1", title: "Org A Meeting", organization: "org-123" }],
      }),
    );
  });

  it("should return empty array if user has no organization context", async () => {
    const mockResults = [
      { id: "1", title: "Org A Meeting", organization: "org-123" },
      { id: "2", title: "Unscoped Meeting", organization: null },
    ];

    vi.spyOn(embeddingUtils, "searchVectorStore").mockResolvedValue(
      mockResults,
    );

    const req = {
      query: { query: "search terms" },
      user: { id: "user-1", organization: null },
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await voiceSearch(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        results: [],
      }),
    );
  });
});
