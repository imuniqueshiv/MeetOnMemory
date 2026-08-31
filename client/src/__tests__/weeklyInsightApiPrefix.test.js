import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLatestInsight,
  getInsightHistory,
  triggerManualGeneration,
} from "../services/weeklyInsightApi.js";
import apiClient from "../services/apiClient.js";

vi.mock("../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("Weekly Insights API Prefix Suite (#2620)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call getLatestInsight with /api/weekly-insights/:orgId/latest", async () => {
    const mockData = { success: true, insight: { _id: "ins-1" } };
    apiClient.get.mockResolvedValueOnce({ data: mockData });

    const result = await getLatestInsight("org-123");

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/weekly-insights/org-123/latest",
    );
    expect(result).toEqual(mockData);
  });

  it("should call getInsightHistory with /api/weekly-insights/:orgId and pagination params", async () => {
    const mockData = { success: true, history: [] };
    apiClient.get.mockResolvedValueOnce({ data: mockData });

    const result = await getInsightHistory("org-123", 2, 5);

    expect(apiClient.get).toHaveBeenCalledWith("/api/weekly-insights/org-123", {
      params: { page: 2, limit: 5 },
    });
    expect(result).toEqual(mockData);
  });

  it("should call triggerManualGeneration with /api/weekly-insights/:orgId/generate", async () => {
    const mockData = { success: true, message: "Generation initiated" };
    apiClient.post.mockResolvedValueOnce({ data: mockData });

    const result = await triggerManualGeneration("org-123");

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/weekly-insights/org-123/generate",
    );
    expect(result).toEqual(mockData);
  });
});
