import { describe, expect, it, vi, beforeEach } from "vitest";
import { effectivenessApi } from "../effectivenessApi.js";
import apiClient from "../apiClient.js";

vi.mock("../apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("effectivenessApi /api prefix verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls POST /api/effectiveness/calculate/:meetingId for calculateMeetingScore", async () => {
    apiClient.post.mockResolvedValueOnce({
      data: { success: true, data: { overallScore: 85 } },
    });

    const result = await effectivenessApi.calculateMeetingScore(
      "m-123",
      "org-456",
      "series-789",
    );

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/effectiveness/calculate/m-123",
      {
        organizationId: "org-456",
        seriesId: "series-789",
      },
    );
    expect(result).toEqual({ success: true, data: { overallScore: 85 } });
  });

  it("calls GET /api/effectiveness/meeting/:meetingId for getMeetingScore", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: { success: true, data: { overallScore: 90 } },
    });

    const result = await effectivenessApi.getMeetingScore("m-123");

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/effectiveness/meeting/m-123",
    );
    expect(result).toEqual({ success: true, data: { overallScore: 90 } });
  });

  it("calls GET /api/effectiveness/organization/:organizationId for getOrganizationTrends", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: { success: true, data: [] },
    });

    const result = await effectivenessApi.getOrganizationTrends("org-456", 30);

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/effectiveness/organization/org-456",
      { params: { days: 30 } },
    );
    expect(result).toEqual({ success: true, data: [] });
  });

  it("calls GET /api/effectiveness/series/:seriesId for getSeriesTrends", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: { success: true, data: [] },
    });

    const result = await effectivenessApi.getSeriesTrends("series-789", 10);

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/effectiveness/series/series-789",
      { params: { limit: 10 } },
    );
    expect(result).toEqual({ success: true, data: [] });
  });
});
