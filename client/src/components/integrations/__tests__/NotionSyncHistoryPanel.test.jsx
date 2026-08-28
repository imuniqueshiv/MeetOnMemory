// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NotionSyncHistoryPanel from "../NotionSyncHistoryPanel.jsx";

describe("NotionSyncHistoryPanel", () => {
  const mockFetchHistory = vi.fn();
  const mockSyncMeeting = vi.fn().mockResolvedValue({});

  const mockHistory = [
    {
      _id: "log-1",
      meetingId: "m-100",
      meetingTitle: "Q4 Roadmap Sync",
      syncedAt: "2026-08-25T20:00:00.000Z",
      status: "success",
      notionPageId: "notion-p1",
      notionPageUrl: "https://notion.so/p1",
    },
    {
      _id: "log-2",
      meetingId: "m-101",
      meetingTitle: "Executive Debrief",
      syncedAt: "2026-08-25T21:00:00.000Z",
      status: "failed",
      errorMessage: "Notion API rate limit exceeded",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders history header and sync log table", () => {
    render(
      <NotionSyncHistoryPanel
        canEdit={true}
        history={mockHistory}
        loadingHistory={false}
        fetchHistory={mockFetchHistory}
        syncMeeting={mockSyncMeeting}
      />,
    );

    expect(screen.getByText(/Notion Sync History/i)).toBeInTheDocument();
    expect(screen.getByText(/Q4 Roadmap Sync/i)).toBeInTheDocument();
    expect(screen.getByText(/Executive Debrief/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Notion API rate limit exceeded/i),
    ).toBeInTheDocument();
  });

  it("calls fetchHistory with status filter when clicking filter buttons", () => {
    render(
      <NotionSyncHistoryPanel
        canEdit={true}
        history={mockHistory}
        loadingHistory={false}
        fetchHistory={mockFetchHistory}
        syncMeeting={mockSyncMeeting}
      />,
    );

    const failedBtn = screen.getByRole("button", { name: /^failed$/i });
    fireEvent.click(failedBtn);

    expect(mockFetchHistory).toHaveBeenCalledWith({ status: "failed" });
  });

  it("triggers retry sync when clicking Retry Sync button", async () => {
    render(
      <NotionSyncHistoryPanel
        canEdit={true}
        history={mockHistory}
        loadingHistory={false}
        fetchHistory={mockFetchHistory}
        syncMeeting={mockSyncMeeting}
      />,
    );

    const retryButtons = screen.getAllByRole("button", { name: /Retry Sync/i });
    fireEvent.click(retryButtons[1]); // log-2 (m-101)

    expect(mockSyncMeeting).toHaveBeenCalledWith("m-101", true);
  });
});
