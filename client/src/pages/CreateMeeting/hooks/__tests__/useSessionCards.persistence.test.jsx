import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSessionCards } from "../useSessionCards";
import { sessionCardApi } from "../../../../services";

vi.mock("../../../../services", () => ({
  sessionCardApi: {
    getSessionCards: vi.fn(),
    generateSession: vi.fn(),
    deleteSessionCard: vi.fn(),
  },
}));

describe("useSessionCards Persistence Hook (#2257)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and initializes existing session cards on mount", async () => {
    const mockCards = [
      {
        _id: "sc-1",
        sessionTitle: "Keynote 2026",
        eventName: "DevFest",
        summary: "Opening keynote overview",
        keywords: ["Keynote", "DevFest"],
      },
    ];

    sessionCardApi.getSessionCards.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          sessions: mockCards,
        },
      },
    });

    const { result } = renderHook(() => useSessionCards());

    await waitFor(() => {
      expect(result.current.generatedSessions).toEqual(mockCards);
    });

    expect(sessionCardApi.getSessionCards).toHaveBeenCalled();
  });

  it("deletes a session card and updates local state", async () => {
    const mockCards = [
      { _id: "sc-1", sessionTitle: "Card 1" },
      { _id: "sc-2", sessionTitle: "Card 2" },
    ];

    sessionCardApi.getSessionCards.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          sessions: mockCards,
        },
      },
    });

    sessionCardApi.deleteSessionCard.mockResolvedValueOnce({
      data: { success: true },
    });

    const { result } = renderHook(() => useSessionCards());

    await waitFor(() => {
      expect(result.current.generatedSessions).toHaveLength(2);
    });

    await act(async () => {
      await result.current.handleDeleteSession("sc-1");
    });

    expect(sessionCardApi.deleteSessionCard).toHaveBeenCalledWith("sc-1");
    expect(result.current.generatedSessions).toEqual([
      { _id: "sc-2", sessionTitle: "Card 2" },
    ]);
  });
});
