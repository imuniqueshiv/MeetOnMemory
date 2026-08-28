// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PersonalNotes from "../PersonalNotes";
import { personalNoteApi } from "../../../services";
import AppContent from "../../../context/AppContent";

vi.mock("../../../services", () => ({
  personalNoteApi: {
    getNoteByMeetingId: vi.fn(),
    upsertNote: vi.fn(),
    togglePin: vi.fn(),
    clearNoteContent: vi.fn(),
  },
}));

describe("PersonalNotes Draft Recovery (#2270)", () => {
  const baseMeeting = {
    _id: "meeting-777",
    title: "Draft Testing Meeting",
    transcript: [],
  };

  const contextValue = {
    userData: { _id: "user-777" },
  };

  const draftKey =
    "meet-on-memory:personal-notes-draft:v1:user-777:meeting-777";

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders recovery banner when a local draft exists and is newer than server", async () => {
    // Server updatedAt: 10 mins ago
    const serverTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    // Draft savedAt: 5 mins ago (newer than server)
    const draftTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    personalNoteApi.getNoteByMeetingId.mockResolvedValueOnce({
      data: {
        success: true,
        note: {
          content: "Server note content",
          isPinned: false,
          annotations: [],
          updatedAt: serverTime,
        },
      },
    });

    const draftData = {
      version: 1,
      savedAt: draftTime,
      values: { content: "Unsaved local draft content!" },
    };
    localStorage.setItem(draftKey, JSON.stringify(draftData));

    render(
      <AppContent.Provider value={contextValue}>
        <PersonalNotes meeting={baseMeeting} />
      </AppContent.Provider>,
    );

    // Verify recovery banner shows up
    await waitFor(() => {
      expect(
        screen.getByTestId("notes-draft-recovery-banner"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Unsaved personal notes draft found/),
    ).toBeInTheDocument();

    // Click Restore
    const restoreBtn = screen.getByTestId("restore-draft-btn");
    fireEvent.click(restoreBtn);

    // Content should update to the restored draft content
    await waitFor(() => {
      expect(
        screen.getByDisplayValue("Unsaved local draft content!"),
      ).toBeInTheDocument();
    });

    // Banner should disappear
    expect(
      screen.queryByTestId("notes-draft-recovery-banner"),
    ).not.toBeInTheDocument();
  });

  it("discards the draft when discard button is clicked", async () => {
    const serverTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const draftTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    personalNoteApi.getNoteByMeetingId.mockResolvedValueOnce({
      data: {
        success: true,
        note: {
          content: "Server content",
          isPinned: false,
          annotations: [],
          updatedAt: serverTime,
        },
      },
    });

    const draftData = {
      version: 1,
      savedAt: draftTime,
      values: { content: "Discardable content" },
    };
    localStorage.setItem(draftKey, JSON.stringify(draftData));

    render(
      <AppContent.Provider value={contextValue}>
        <PersonalNotes meeting={baseMeeting} />
      </AppContent.Provider>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("notes-draft-recovery-banner"),
      ).toBeInTheDocument();
    });

    const discardBtn = screen.getByTestId("discard-draft-btn");
    fireEvent.click(discardBtn);

    // Banner disappears and content remains server content
    await waitFor(() => {
      expect(
        screen.queryByTestId("notes-draft-recovery-banner"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Server content")).toBeInTheDocument();
    expect(localStorage.getItem(draftKey)).toBeNull();
  });

  it("discards the draft and does not render banner if server note is fresher", async () => {
    // Server updatedAt: 5 mins ago (fresher/newer)
    const serverTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    // Draft savedAt: 10 mins ago (older than server)
    const draftTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    personalNoteApi.getNoteByMeetingId.mockResolvedValueOnce({
      data: {
        success: true,
        note: {
          content: "Server content is fresher",
          isPinned: false,
          annotations: [],
          updatedAt: serverTime,
        },
      },
    });

    const draftData = {
      version: 1,
      savedAt: draftTime,
      values: { content: "Stale draft content" },
    };
    localStorage.setItem(draftKey, JSON.stringify(draftData));

    render(
      <AppContent.Provider value={contextValue}>
        <PersonalNotes meeting={baseMeeting} />
      </AppContent.Provider>,
    );

    // Wait for editor to load
    await waitFor(() => {
      expect(
        screen.getByDisplayValue("Server content is fresher"),
      ).toBeInTheDocument();
    });

    // Banner must NOT render, and draft is removed from localStorage
    expect(
      screen.queryByTestId("notes-draft-recovery-banner"),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem(draftKey)).toBeNull();
  });
});
