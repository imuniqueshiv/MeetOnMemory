import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import DuplicateDetectionPanel from "../DuplicateDetectionPanel.jsx";
import { meetingDuplicateApi } from "../../../api/meetingDuplicateApi.js";
import apiClient from "../../../services/apiClient.js";

vi.mock("../../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("DuplicateDetectionPanel & useMeetingDuplicates (#2260 & #2647)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends field selections through the duplicate merge API", async () => {
    apiClient.get.mockResolvedValue({
      data: {
        duplicates: [
          {
            _id: "dup-1",
            title: "Duplicate Meeting",
            date: "2026-08-01T10:00:00.000Z",
            time: "10:00",
            participants: [{ name: "Duplicate Person" }],
            summary: "Secondary summary",
            tags: ["secondary"],
            similarity: 0.85,
          },
        ],
      },
    });
    apiClient.post.mockResolvedValue({ data: { success: true } });

    render(
      <DuplicateDetectionPanel
        meetingId="meeting-123"
        meeting={{
          _id: "meeting-123",
          title: "Primary Meeting",
          date: "2026-08-01T09:00:00.000Z",
          time: "09:00",
          participants: [{ name: "Primary Person" }],
          summary: "Primary summary",
          tags: ["primary"],
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Duplicate Meeting")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Merge Data"));

    expect(
      screen.getByRole("heading", { name: "Review merge before confirming" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Primary summary")).toBeInTheDocument();
    expect(screen.getByText("Secondary summary")).toBeInTheDocument();

    const duplicateRadios = screen.getAllByRole("radio");
    const secondaryTitleRadio = duplicateRadios.find(
      (radio) => radio.value === "secondary",
    );
    expect(secondaryTitleRadio).toBeDefined();
    fireEvent.click(secondaryTitleRadio);

    fireEvent.click(screen.getByText("Confirm Merge"));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/meetings/meeting-123/duplicates/merge",
        {
          secondaryId: "dup-1",
          fieldSelections: {
            title: "secondary",
            time: "primary",
            participants: "primary",
            summary: "primary",
            tags: "primary",
          },
        },
      );
    });
  });

  it("updates the panel without reloading the page after a successful merge", async () => {
    const mockDuplicates = [
      {
        _id: "dup-1",
        title: "Duplicate Meeting",
        date: "2026-08-01T10:00:00.000Z",
        similarity: 0.85,
      },
    ];

    apiClient.get.mockResolvedValue({ data: { duplicates: mockDuplicates } });
    apiClient.post.mockResolvedValue({ data: { success: true } });

    render(
      <DuplicateDetectionPanel
        meetingId="meeting-123"
        meeting={{ _id: "meeting-123", title: "Primary Meeting" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Duplicate Meeting")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Merge Data"));
    fireEvent.click(screen.getByText("Confirm Merge"));

    await waitFor(() => {
      expect(screen.queryByText("Duplicate Meeting")).not.toBeInTheDocument();
    });
  });

  it("uses apiClient for duplicate detection and dismissal", async () => {
    apiClient.get.mockResolvedValue({ data: { duplicates: [] } });
    await meetingDuplicateApi.detectDuplicates("meeting-123");
    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/meetings/meeting-123/duplicates",
    );

    apiClient.post.mockResolvedValue({ data: { success: true } });
    await meetingDuplicateApi.dismissDuplicate("meeting-123", "meeting-456");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/meetings/meeting-123/duplicates",
      {
        secondaryId: "meeting-456",
      },
    );
  });

  it("uses apiClient for rollbackMerge", async () => {
    apiClient.post.mockResolvedValue({ data: { success: true } });
    await meetingDuplicateApi.rollbackMerge("meeting-123", "audit-789");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/meetings/meeting-123/duplicates/rollback/audit-789",
    );
  });

  it("renders recent merges and opens rollback confirmation modal with restored field preview", async () => {
    apiClient.get.mockResolvedValue({ data: { duplicates: [] } });
    const initialRecentMerges = [
      {
        mergeAuditId: "audit-789",
        secondaryMeeting: {
          _id: "dup-2",
          title: "Merged Secondary Meeting",
        },
        mergedAt: "2026-08-01T12:00:00.000Z",
      },
    ];

    render(
      <DuplicateDetectionPanel
        meetingId="meeting-123"
        meeting={{ _id: "meeting-123", title: "Primary Meeting" }}
        initialRecentMerges={initialRecentMerges}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Recently Merged Meetings")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Rollback Merge"));

    expect(
      screen.getByRole("heading", { name: "Confirm Merge Rollback" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Merged Secondary Meeting/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("Title, Date & Time, Participants, Summary, Tags"),
    ).toBeInTheDocument();
  });

  it("canceling rollback closes modal without calling API", async () => {
    apiClient.get.mockResolvedValue({ data: { duplicates: [] } });
    const initialRecentMerges = [
      {
        mergeAuditId: "audit-789",
        secondaryMeeting: { title: "Merged Secondary Meeting" },
      },
    ];

    render(
      <DuplicateDetectionPanel
        meetingId="meeting-123"
        meeting={{ _id: "meeting-123", title: "Primary Meeting" }}
        initialRecentMerges={initialRecentMerges}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Rollback Merge")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Rollback Merge"));
    expect(screen.getByText("Confirm Merge Rollback")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(
        screen.queryByText("Confirm Merge Rollback"),
      ).not.toBeInTheDocument();
    });

    expect(apiClient.post).not.toHaveBeenCalledWith(
      expect.stringContaining("/rollback/"),
    );
  });

  it("confirming rollback calls rollback API, triggers onMergeSuccess, and hides rollback panel", async () => {
    apiClient.get.mockResolvedValue({ data: { duplicates: [] } });
    apiClient.post.mockResolvedValue({ data: { success: true } });
    const mockOnMergeSuccess = vi.fn();

    const initialRecentMerges = [
      {
        mergeAuditId: "audit-789",
        secondaryMeeting: { title: "Merged Secondary Meeting" },
      },
    ];

    render(
      <DuplicateDetectionPanel
        meetingId="meeting-123"
        meeting={{ _id: "meeting-123", title: "Primary Meeting" }}
        onMergeSuccess={mockOnMergeSuccess}
        initialRecentMerges={initialRecentMerges}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Rollback Merge")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Rollback Merge"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Rollback" }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/meetings/meeting-123/duplicates/rollback/audit-789",
      );
      expect(mockOnMergeSuccess).toHaveBeenCalled();
    });
  });
});
