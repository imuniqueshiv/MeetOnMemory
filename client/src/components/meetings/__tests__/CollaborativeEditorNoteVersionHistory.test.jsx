import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CollaborativeEditor from "../CollaborativeEditor.jsx";

vi.mock("../../../hooks/useCollaborativeNote", () => ({
  useCollaborativeNote: () => ({
    ydoc: { getText: () => ({}) },
    isConnected: true,
    isLoading: false,
    syncStatus: "synced",
    activeUsers: [],
    userColor: "#3366ff",
    broadcastCursor: vi.fn(),
    saveSnapshot: vi.fn().mockResolvedValue({ success: true }),
  }),
  COLLAB_SYNC_STATUS: {
    CONNECTING: "connecting",
    SYNCED: "synced",
    SAVING: "saving",
    OFFLINE: "offline",
    ERROR: "error",
  },
}));

vi.mock("@tiptap/react", () => ({
  useEditor: () => ({
    state: { selection: { from: 0, to: 0 } },
  }),
  EditorContent: () => <div data-testid="editor-content" />,
}));

vi.mock("@tiptap/starter-kit", () => ({
  default: { configure: () => ({}) },
}));
vi.mock("@tiptap/extension-collaboration", () => ({
  default: { configure: () => ({}) },
}));
vi.mock("@tiptap/extension-collaboration-cursor", () => ({
  default: { configure: () => ({}) },
}));
vi.mock("@tiptap/extension-placeholder", () => ({
  default: { configure: () => ({}) },
}));

vi.mock("../PresenceAvatars", () => ({
  default: () => <div data-testid="presence" />,
}));

vi.mock("../VersionHistory", () => ({
  default: ({ onOpenFullHistory }) => (
    <button
      type="button"
      onClick={onOpenFullHistory}
      data-testid="sidebar-diff"
    >
      Sidebar Diff
    </button>
  ),
}));

vi.mock("../../NoteVersionHistory", () => ({
  default: ({ meetingId, field, onClose }) => (
    <div
      data-testid="note-version-history"
      data-meeting-id={meetingId}
      data-field={field}
      role="dialog"
    >
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

describe("CollaborativeEditor NoteVersionHistory wiring (#1995)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens NoteVersionHistory for collaborativeNotes from Diff & Restore", () => {
    render(<CollaborativeEditor meetingId="meet-42" />);

    expect(
      screen.queryByTestId("note-version-history"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("open-note-version-history"));

    const dialog = screen.getByTestId("note-version-history");
    expect(dialog).toHaveAttribute("data-meeting-id", "meet-42");
    expect(dialog).toHaveAttribute("data-field", "collaborativeNotes");
  });

  it("opens NoteVersionHistory from the sidebar Diff control", () => {
    render(<CollaborativeEditor meetingId="meet-42" />);

    fireEvent.click(screen.getByTestId("sidebar-diff"));
    expect(screen.getByTestId("note-version-history")).toBeInTheDocument();
  });
});
