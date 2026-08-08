import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AttachmentPanel from "../AttachmentPanel";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../services", () => ({
  attachmentApi: {
    getAttachments: vi.fn(),
    uploadAttachment: vi.fn(),
    downloadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
  },
}));

import { attachmentApi } from "../../../services";

describe("AttachmentPanel accessibility & Dark Mode (#1227)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes accessible names for icon-only attachment actions", async () => {
    attachmentApi.getAttachments.mockResolvedValue({
      data: {
        success: true,
        attachments: [
          {
            _id: "att-1",
            fileName: "agenda.pdf",
            mimeType: "application/pdf",
            fileSize: 1024,
            uploadedBy: { name: "Alice" },
            createdAt: "2024-01-15T00:00:00.000Z",
          },
        ],
      },
    });

    render(<AttachmentPanel meetingId="meeting-1" />);

    await waitFor(() => {
      expect(screen.getByText("agenda.pdf")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Download attachment" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete attachment" }),
    ).toBeInTheDocument();
  });

  it("applies dark mode CSS classes for complete theme support", async () => {
    attachmentApi.getAttachments.mockResolvedValue({
      data: { success: true, attachments: [] },
    });

    const { container } = render(<AttachmentPanel meetingId="meeting-1" />);

    await waitFor(() => {
      expect(screen.getByText("No attachments yet")).toBeInTheDocument();
    });

    const rootElement = container.firstChild;
    expect(rootElement).toHaveClass("dark:bg-slate-900");
    expect(rootElement).toHaveClass("dark:border-slate-800");
  });
});
