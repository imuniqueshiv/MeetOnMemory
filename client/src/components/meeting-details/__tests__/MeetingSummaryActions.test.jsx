import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MeetingSummary from "../MeetingSummary";
import { meetingApi, aiSummaryTemplateApi } from "../../../services";

// Mock services
vi.mock("../../../services", () => ({
  meetingApi: {
    summarizeMeeting: vi.fn(),
  },
  aiSummaryTemplateApi: {
    getTemplates: vi.fn(),
  },
}));

// Mock NoteVersionHistory component
vi.mock("../../NoteVersionHistory", () => ({
  default: ({ meetingId, field, onClose, onRestored }) => (
    <div data-testid="mock-note-version-history">
      <span>
        Version History for {field} on {meetingId}
      </span>
      <button
        onClick={() =>
          onRestored({
            summary: { summary: "Restored MoM Summary" },
          })
        }
      >
        Trigger Restore
      </button>
      <button onClick={onClose}>Close History</button>
    </div>
  ),
}));

// Mock Toastify
vi.mock("react-toastify", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("MeetingSummary Actions & Overwrite Confirmation Dialog", () => {
  const mockMeeting = {
    _id: "m-101",
    title: "Sprint Sync",
    date: "2026-08-24T10:00:00Z",
    summary: {
      summary: "Existing Executive Summary",
      agenda: ["Topic A", "Topic B"],
      decisions: ["Approved budget"],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Regenerate Summary, Apply Template, and Restore Previous buttons", () => {
    render(<MeetingSummary meeting={mockMeeting} />);

    expect(screen.getByTestId("regenerate-summary-btn")).toBeInTheDocument();
    expect(screen.getByTestId("apply-template-btn")).toBeInTheDocument();
    expect(screen.getByTestId("restore-previous-btn")).toBeInTheDocument();
  });

  it("triggers confirmation overwrite modal when regenerating an existing summary", async () => {
    render(<MeetingSummary meeting={mockMeeting} />);

    const regenerateBtn = screen.getByTestId("regenerate-summary-btn");
    fireEvent.click(regenerateBtn);

    // Confirmation dialog should be visible
    expect(screen.getByText("Confirm Regenerate Summary")).toBeInTheDocument();
    expect(
      screen.getByText(/Regenerating will overwrite existing MoM sections/i),
    ).toBeInTheDocument();

    // Confirm action
    meetingApi.summarizeMeeting.mockResolvedValue({
      data: {
        success: true,
        mom: { summary: "New Regenerated Summary" },
      },
    });

    const confirmBtn = screen.getByTestId("confirm-overwrite-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(meetingApi.summarizeMeeting).toHaveBeenCalledWith({
        meetingId: "m-101",
        date: "2026-08-24T10:00:00Z",
        title: "Sprint Sync",
        templateId: undefined,
      });
      expect(screen.getByText("New Regenerated Summary")).toBeInTheDocument();
    });
  });

  it("opens template modal, allows selecting a template, and prompts confirmation before applying", async () => {
    aiSummaryTemplateApi.getTemplates.mockResolvedValue([
      {
        _id: "tpl-1",
        name: "Executive Brief Template",
        description: "High level summary format",
        isDefault: true,
      },
    ]);

    render(<MeetingSummary meeting={mockMeeting} />);

    const applyTemplateBtn = screen.getByTestId("apply-template-btn");
    fireEvent.click(applyTemplateBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Select AI Summary Template"),
      ).toBeInTheDocument();
      expect(screen.getByText("Executive Brief Template")).toBeInTheDocument();
    });

    // Select the template
    const templateItem = screen.getByText("Executive Brief Template");
    fireEvent.click(templateItem);

    // Confirm overwrite modal appears
    await waitFor(() => {
      expect(
        screen.getByText("Apply Template: Executive Brief Template"),
      ).toBeInTheDocument();
    });

    meetingApi.summarizeMeeting.mockResolvedValue({
      data: {
        success: true,
        mom: { summary: "Templated Summary Output" },
      },
    });

    const confirmBtn = screen.getByTestId("confirm-overwrite-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(meetingApi.summarizeMeeting).toHaveBeenCalledWith({
        meetingId: "m-101",
        date: "2026-08-24T10:00:00Z",
        title: "Sprint Sync",
        templateId: "tpl-1",
      });
      expect(screen.getByText("Templated Summary Output")).toBeInTheDocument();
    });
  });

  it("opens NoteVersionHistory modal when clicking Restore Previous", async () => {
    render(<MeetingSummary meeting={mockMeeting} />);

    const restoreBtn = screen.getByTestId("restore-previous-btn");
    fireEvent.click(restoreBtn);

    expect(screen.getByTestId("mock-note-version-history")).toBeInTheDocument();
    expect(
      screen.getByText("Version History for summary on m-101"),
    ).toBeInTheDocument();

    // Trigger restore
    const triggerRestoreBtn = screen.getByText("Trigger Restore");
    fireEvent.click(triggerRestoreBtn);

    await waitFor(() => {
      expect(screen.getByText("Restored MoM Summary")).toBeInTheDocument();
    });
  });
});
