import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEffectivenessScore } from "../useEffectivenessScore.js";
import { effectivenessApi } from "../../services/effectivenessApi.js";

vi.mock("../../services/effectivenessApi.js", () => ({
  effectivenessApi: {
    getMeetingScore: vi.fn(),
    calculateMeetingScore: vi.fn(),
    getOrganizationTrends: vi.fn(),
    getSeriesTrends: vi.fn(),
  },
}));

describe("useEffectivenessScore hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches meeting score successfully and updates state", async () => {
    const mockScore = { overallScore: 92, dimensions: {} };
    effectivenessApi.getMeetingScore.mockResolvedValueOnce({
      success: true,
      data: mockScore,
    });

    const { result } = renderHook(() => useEffectivenessScore());

    await act(async () => {
      await result.current.fetchMeetingScore("m-1");
    });

    expect(effectivenessApi.getMeetingScore).toHaveBeenCalledWith("m-1");
    expect(result.current.meetingScore).toEqual(mockScore);
    expect(result.current.error).toBeNull();
  });

  it("handles meeting score fetch error gracefully", async () => {
    effectivenessApi.getMeetingScore.mockRejectedValueOnce(
      new Error("Network Error"),
    );

    const { result } = renderHook(() => useEffectivenessScore());

    await act(async () => {
      await result.current.fetchMeetingScore("m-1");
    });

    expect(result.current.meetingScore).toBeNull();
    expect(result.current.error).toBe("Network Error");
  });

  it("resets meeting score when meetingId is null/empty", async () => {
    const { result } = renderHook(() => useEffectivenessScore());

    await act(async () => {
      await result.current.fetchMeetingScore(null);
    });

    expect(effectivenessApi.getMeetingScore).not.toHaveBeenCalled();
    expect(result.current.meetingScore).toBeNull();
  });

  it("fetches organization trends with default array fallback", async () => {
    effectivenessApi.getOrganizationTrends.mockResolvedValueOnce({
      success: true,
      data: [{ date: "2026-08-01", averageScore: 80 }],
    });

    const { result } = renderHook(() => useEffectivenessScore());

    await act(async () => {
      await result.current.fetchOrgTrends("org-1", 30);
    });

    expect(effectivenessApi.getOrganizationTrends).toHaveBeenCalledWith(
      "org-1",
      30,
    );
    expect(result.current.orgTrends).toHaveLength(1);
  });
});
