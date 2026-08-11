import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NoteVersionHistory from "../NoteVersionHistory.jsx";
import apiClient from "../../services/apiClient";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../services/apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("NoteVersionHistory Accessibility (#1338)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes WAI-ARIA dialog attributes when rendered", async () => {
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        versions: [
          {
            _id: "v-1",
            version: 1,
            changeSource: "user_edit",
            createdAt: "2026-08-01T10:00:00.000Z",
            bytesDiff: 15,
          },
        ],
      },
    });

    render(
      <NoteVersionHistory
        meetingId="meeting-1"
        field="summary"
        onClose={() => {}}
        onRestored={() => {}}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby");
  });

  it("closes modal on Escape key press", async () => {
    apiClient.get.mockResolvedValue({
      data: { success: true, versions: [] },
    });

    const onClose = vi.fn();
    render(
      <NoteVersionHistory
        meetingId="meeting-1"
        field="summary"
        onClose={onClose}
        onRestored={() => {}}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("supports keyboard selection on version list items", async () => {
    apiClient.get.mockImplementation((url) => {
      if (url.includes("/history")) {
        return Promise.resolve({
          data: {
            success: true,
            versions: [
              {
                _id: "v-1",
                version: 1,
                changeSource: "user_edit",
                createdAt: "2026-08-01T10:00:00.000Z",
                bytesDiff: 15,
              },
            ],
          },
        });
      }
      if (url.includes("/diff")) {
        return Promise.resolve({
          data: {
            success: true,
            diff: [{ value: "Sample diff text", added: true }],
          },
        });
      }
      return Promise.resolve({ data: { success: false } });
    });

    render(
      <NoteVersionHistory
        meetingId="meeting-1"
        field="summary"
        onClose={() => {}}
        onRestored={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Version 1 (Latest)")).toBeInTheDocument();
    });

    const versionItem = screen.getByRole("button", { name: /version 1/i });
    fireEvent.keyDown(versionItem, { key: "Enter" });

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/note-versions/version/v-1/diff",
      );
    });
  });
});
