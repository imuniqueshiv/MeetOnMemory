import { describe, expect, it, vi, beforeEach } from "vitest";
import { speakingTimeApi } from "../speakingTimeApi.js";
import apiClient from "../apiClient.js";

vi.mock("../apiClient.js", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("speakingTimeApi /api prefix path-locking tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls GET /api/speaking-time/:meetingId/breakdown for getBreakdown", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: { success: true, data: {} },
    });

    await speakingTimeApi.getBreakdown("m-100");

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/speaking-time/m-100/breakdown",
    );
  });

  it("calls GET /api/speaking-time/trends?limit=:limit for getTrends", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: { success: true, data: [] },
    });

    await speakingTimeApi.getTrends(10);

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/speaking-time/trends?limit=10",
    );
  });

  it("calls GET /api/speaking-time/org-compare for getOrgCompare", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: { success: true, data: { meetingCount: 5 } },
    });

    await speakingTimeApi.getOrgCompare("2026-01-01", "2026-01-31");

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/speaking-time/org-compare",
      {
        params: {
          startDate: "2026-01-01",
          endDate: "2026-01-31",
        },
      },
    );
  });
});
