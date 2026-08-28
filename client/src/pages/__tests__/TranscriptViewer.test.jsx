import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TranscriptViewer from "../TranscriptViewer.jsx";
import api from "../../services/apiClient.js";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar">Navbar</div>,
}));

vi.mock("../../components/MeetingSentimentChart", () => ({
  default: () => <div data-testid="mock-sentiment-chart">Sentiment Chart</div>,
}));

vi.mock("../../components/meeting-details/SpeakerAttribution", () => ({
  default: () => null,
}));

vi.mock("../../components/meeting-details/TranscriptTimelineScrubber", () => ({
  default: ({ meeting, transcript }) => (
    <div
      data-testid="mock-transcript-scrubber"
      data-has-media={
        meeting?.fileUrl || meeting?.audioFilePath || transcript?.audioFilePath
          ? "yes"
          : "no"
      }
    >
      Scrubber
    </div>
  ),
}));

vi.mock("../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
  },
}));

import AppContent from "../../context/AppContent.js";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useParams: () => ({ meetingId: "meeting-789" }),
  useNavigate: () => mockNavigate,
}));

describe("TranscriptViewer Page (#1805)", () => {
  const sampleTranscriptData = {
    duration: 120,
    meeting: {
      _id: "meeting-789",
      title: "Design Review",
      date: "2026-08-20T10:00:00.000Z",
      participants: [{ name: "Alice" }, { name: "Bob" }],
    },
    segments: [
      {
        startTime: 0,
        endTime: 10,
        speaker: "Alice",
        text: "Welcome everyone to the meeting.",
      },
      {
        startTime: 11,
        endTime: 25,
        speaker: "Bob",
        text: "Thanks Alice, glad to be here.",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    window.URL.revokeObjectURL = vi.fn();
  });

  it("renders Navbar during loading state", () => {
    api.get.mockImplementation(() => new Promise(() => {}));
    render(<TranscriptViewer />);

    expect(screen.getByTestId("mock-navbar")).toBeInTheDocument();
    expect(screen.getByText("Loading transcript...")).toBeInTheDocument();
  });

  it("renders Navbar and not found message when transcript is not found", async () => {
    api.get.mockResolvedValueOnce({ data: null });
    render(<TranscriptViewer />);

    await waitFor(() => {
      expect(screen.getByText("Transcript Not Found")).toBeInTheDocument();
    });
    expect(screen.getByTestId("mock-navbar")).toBeInTheDocument();
  });

  it("fetches transcript using /api/transcripts/meeting/:meetingId route prefix", async () => {
    api.get.mockResolvedValueOnce({ data: sampleTranscriptData });
    render(<TranscriptViewer />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/api/transcripts/meeting/meeting-789",
      );
    });

    expect(screen.getByTestId("mock-navbar")).toBeInTheDocument();
    expect(screen.getByText("Design Review")).toBeInTheDocument();
    expect(
      screen.getAllByText("Welcome everyone to the meeting.")[0],
    ).toBeInTheDocument();
  });

  it("mounts transcript timeline scrubber (#2252)", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        ...sampleTranscriptData,
        meeting: {
          ...sampleTranscriptData.meeting,
          fileUrl: "recordings/design.mp3",
        },
      },
    });
    render(<TranscriptViewer />);

    const scrubber = await screen.findByTestId("mock-transcript-scrubber");
    expect(scrubber).toHaveAttribute("data-has-media", "yes");
  });

  it("searches transcript using /api/transcripts/meeting/:meetingId/search route prefix", async () => {
    api.get.mockResolvedValueOnce({ data: sampleTranscriptData });
    api.post.mockResolvedValueOnce({
      data: {
        matches: [
          {
            startTime: 0,
            speaker: "Alice",
            text: "Welcome everyone to the meeting.",
          },
        ],
      },
    });

    render(<TranscriptViewer />);

    await waitFor(() => {
      expect(screen.getByText("Design Review")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search transcript...");
    fireEvent.change(searchInput, { target: { value: "Welcome" } });

    const searchButton = screen.getByRole("button", { name: /^search$/i });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/api/transcripts/meeting/meeting-789/search",
        { query: "Welcome" },
      );
    });

    expect(await screen.findByText("Search Results")).toBeInTheDocument();
  });

  it("exports transcript text using /api/transcripts/meeting/:meetingId/export/text route prefix", async () => {
    api.get.mockResolvedValueOnce({ data: sampleTranscriptData });
    api.get.mockResolvedValueOnce({ data: "sample transcript text" });

    render(<TranscriptViewer />);

    await waitFor(() => {
      expect(screen.getByText("Design Review")).toBeInTheDocument();
    });

    const exportTxtBtn = screen.getByTitle("Export as text");
    fireEvent.click(exportTxtBtn);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/api/transcripts/meeting/meeting-789/export/text",
        { responseType: "blob" },
      );
    });
  });

  it("exports transcript PDF using /api/transcripts/meeting/:meetingId/export/pdf route prefix", async () => {
    api.get.mockResolvedValueOnce({ data: sampleTranscriptData });
    api.get.mockResolvedValueOnce({ data: new Blob(["pdf content"]) });

    render(<TranscriptViewer />);

    await waitFor(() => {
      expect(screen.getByText("Design Review")).toBeInTheDocument();
    });

    const exportPdfBtn = screen.getByTitle("Export as PDF");
    fireEvent.click(exportPdfBtn);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/api/transcripts/meeting/meeting-789/export/pdf",
        { responseType: "blob" },
      );
    });
  });

  describe("Inline Segment Editing (#2251)", () => {
    const mockAdminContext = {
      userData: { _id: "admin_123", role: "admin" },
    };
    const mockGuestContext = {
      userData: { _id: "guest_123", role: "guest" },
    };

    it("renders edit button for authorized users and opens inline editor", async () => {
      api.get.mockResolvedValueOnce({ data: sampleTranscriptData });

      render(
        <AppContent.Provider value={mockAdminContext}>
          <TranscriptViewer />
        </AppContent.Provider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Design Review")).toBeInTheDocument();
      });

      const editBtns = screen.getAllByRole("button", { name: /edit segment/i });
      expect(editBtns.length).toBe(2);

      // Click first edit button
      fireEvent.click(editBtns[0]);

      expect(screen.getByText("Editing Segment #1")).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("Welcome everyone to the meeting."),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("00:00")).toBeInTheDocument();
      expect(screen.getByDisplayValue("00:10")).toBeInTheDocument();
    });

    it("saves segment text and timestamps via API and updates UI optimistically", async () => {
      api.get.mockResolvedValueOnce({ data: sampleTranscriptData });
      api.patch.mockResolvedValueOnce({
        data: {
          success: true,
          message: "Transcript segment updated successfully",
        },
      });

      render(
        <AppContent.Provider value={mockAdminContext}>
          <TranscriptViewer />
        </AppContent.Provider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Design Review")).toBeInTheDocument();
      });

      const editBtns = screen.getAllByRole("button", { name: /edit segment/i });
      fireEvent.click(editBtns[0]);

      const textarea = screen.getByDisplayValue(
        "Welcome everyone to the meeting.",
      );
      fireEvent.change(textarea, {
        target: { value: "Updated welcome text from Alice." },
      });

      const startInput = screen.getByDisplayValue("00:00");
      fireEvent.change(startInput, { target: { value: "00:02" } });

      const saveBtn = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(api.patch).toHaveBeenCalledWith(
          "/api/transcripts/meeting-789/segments/0",
          {
            text: "Updated welcome text from Alice.",
            startTime: 2,
            endTime: 10,
          },
        );
      });

      // Assert optimistic update
      expect(
        screen.getByText("Updated welcome text from Alice."),
      ).toBeInTheDocument();
      expect(screen.getByText("Edited")).toBeInTheDocument();
    });

    it("cancels segment editing and restores original view", async () => {
      api.get.mockResolvedValueOnce({ data: sampleTranscriptData });

      render(
        <AppContent.Provider value={mockAdminContext}>
          <TranscriptViewer />
        </AppContent.Provider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Design Review")).toBeInTheDocument();
      });

      const editBtns = screen.getAllByRole("button", { name: /edit segment/i });
      fireEvent.click(editBtns[0]);

      const cancelBtn = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelBtn);

      expect(screen.queryByText("Editing Segment #1")).not.toBeInTheDocument();
      expect(
        screen.getByText("Welcome everyone to the meeting."),
      ).toBeInTheDocument();
      expect(api.patch).not.toHaveBeenCalled();
    });

    it("hides edit buttons for unauthorized users", async () => {
      api.get.mockResolvedValueOnce({ data: sampleTranscriptData });

      render(
        <AppContent.Provider value={mockGuestContext}>
          <TranscriptViewer />
        </AppContent.Provider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Design Review")).toBeInTheDocument();
      });

      const editBtns = screen.queryAllByRole("button", {
        name: /edit segment/i,
      });
      expect(editBtns.length).toBe(0);
    });
  });
});
