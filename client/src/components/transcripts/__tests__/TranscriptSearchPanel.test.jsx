import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import TranscriptSearchPanel from "../TranscriptSearchPanel";
import api from "../../../services/apiClient.js";

vi.mock("../../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
    isCancel: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("TranscriptSearchPanel", () => {
  const mockResults = [
    {
      meetingId: "meet-1",
      meetingTitle: "Project Kickoff",
      meetingDate: "2023-10-01T10:00:00Z",
      score: 0.95,
      segmentIndex: 5,
      contextSegments: [
        {
          speaker: "Alice",
          startTime: 120,
          text: "We should finalize the design mockups.",
        },
        {
          speaker: "Bob",
          startTime: 125,
          text: "I agree, the design is crucial here.",
        },
      ],
    },
    {
      meetingId: "meet-2",
      meetingTitle: "Design Sync",
      meetingDate: "2023-10-05T14:00:00Z",
      score: 0.88,
      segmentIndex: 12,
      contextSegments: [
        {
          speaker: "Charlie",
          startTime: 300,
          text: "The new design looks great on mobile.",
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <TranscriptSearchPanel />
      </BrowserRouter>,
    );
  };

  it("renders initial empty state properly", () => {
    renderComponent();
    expect(screen.getByText("Global Transcript Search")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Search exactly what was said..."),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Filter by speaker..."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Enter a phrase or keyword/i)).toBeInTheDocument();
  });

  it("fetches and displays search results after typing with debounce", async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: { results: mockResults } },
    });

    renderComponent();

    const searchInput = screen.getByPlaceholderText(
      "Search exactly what was said...",
    );
    fireEvent.change(searchInput, { target: { value: "design" } });

    // We expect the searching text to appear while debounce + api call resolves
    // waitFor handles waiting for the timeout naturally
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/api/transcripts/search/global",
        expect.objectContaining({
          params: { q: "design", speaker: "" },
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Project Kickoff")).toBeInTheDocument();
      expect(screen.getByText("Design Sync")).toBeInTheDocument();
    });

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("2:00")).toBeInTheDocument();
    expect(screen.getByText("5:00")).toBeInTheDocument();
  });

  it("handles filtering by speaker", async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: { results: [mockResults[1]] } },
    });

    renderComponent();

    const searchInput = screen.getByPlaceholderText(
      "Search exactly what was said...",
    );
    const speakerInput = screen.getByPlaceholderText("Filter by speaker...");

    fireEvent.change(searchInput, { target: { value: "design" } });
    fireEvent.change(speakerInput, { target: { value: "Charlie" } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/api/transcripts/search/global",
        expect.objectContaining({
          params: { q: "design", speaker: "Charlie" },
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Design Sync")).toBeInTheDocument();
      expect(screen.queryByText("Project Kickoff")).not.toBeInTheDocument();
    });
  });

  it("shows empty state when no results match the query", async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: { results: [] } },
    });

    renderComponent();

    const searchInput = screen.getByPlaceholderText(
      "Search exactly what was said...",
    );
    fireEvent.change(searchInput, { target: { value: "nonexistentquery" } });

    await waitFor(() => {
      expect(
        screen.getByText(/No utterances found matching/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/"nonexistentquery"/i)).toBeInTheDocument();
    });
  });

  it("handles API errors gracefully", async () => {
    const error = new Error("Network Error");
    api.get.mockRejectedValueOnce(error);

    renderComponent();

    const searchInput = screen.getByPlaceholderText(
      "Search exactly what was said...",
    );
    fireEvent.change(searchInput, { target: { value: "error query" } });

    await waitFor(() => {
      expect(
        screen.getByText("Failed to search transcripts."),
      ).toBeInTheDocument();
    });
  });

  it("aborts previous requests when a new request is made", async () => {
    api.get.mockResolvedValue({
      data: { success: true, data: { results: [mockResults[0]] } },
    });

    renderComponent();

    const searchInput = screen.getByPlaceholderText(
      "Search exactly what was said...",
    );
    fireEvent.change(searchInput, { target: { value: "first" } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(1);
    });

    const abortSignal1 = api.get.mock.calls[0][1].signal;
    expect(abortSignal1.aborted).toBe(false);

    fireEvent.change(searchInput, { target: { value: "second" } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(2);
    });

    expect(abortSignal1.aborted).toBe(true);
  });

  it("navigates to the correct meeting and segment when clicking a result", async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: { results: mockResults } },
    });

    renderComponent();

    const searchInput = screen.getByPlaceholderText(
      "Search exactly what was said...",
    );
    fireEvent.change(searchInput, { target: { value: "design" } });

    await waitFor(() => {
      expect(screen.getByText("Project Kickoff")).toBeInTheDocument();
    });

    const resultElement = screen.getByText("Project Kickoff").closest(".group");
    fireEvent.click(resultElement);

    expect(mockNavigate).toHaveBeenCalledWith(
      "/transcript/meet-1?highlight=design&segment=5",
    );
  });

  it("highlights the matched text properly", async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: { results: mockResults } },
    });

    renderComponent();

    const searchInput = screen.getByPlaceholderText(
      "Search exactly what was said...",
    );
    fireEvent.change(searchInput, { target: { value: "design" } });

    await waitFor(() => {
      expect(screen.getByText("Project Kickoff")).toBeInTheDocument();
    });

    const marks = document.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].textContent.toLowerCase()).toBe("design");
    expect(marks[0].className).toContain("bg-yellow-300");
  });

  it("clears results when query becomes empty", async () => {
    api.get.mockResolvedValueOnce({
      data: { success: true, data: { results: mockResults } },
    });

    renderComponent();

    const searchInput = screen.getByPlaceholderText(
      "Search exactly what was said...",
    );

    fireEvent.change(searchInput, { target: { value: "design" } });

    await waitFor(() => {
      expect(screen.getByText("Project Kickoff")).toBeInTheDocument();
    });

    fireEvent.change(searchInput, { target: { value: "" } });

    await waitFor(() => {
      expect(screen.queryByText("Project Kickoff")).not.toBeInTheDocument();
      expect(
        screen.getByText(/Enter a phrase or keyword/i),
      ).toBeInTheDocument();
    });
  });
});
