import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AttachmentPanel from "../AttachmentPanel";
import { toast } from "react-toastify";

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
    previewAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
  },

  savedFilterApi: {
    getSavedFilters: vi.fn().mockResolvedValue({ data: [] }),
    createSavedFilter: vi.fn(),
    deleteSavedFilter: vi.fn(),
  },
}));

import { attachmentApi } from "../../../services";

const SAMPLE_ATTACHMENT = {
  _id: "att-1",
  fileName: "agenda.pdf",
  mimeType: "application/pdf",
  fileSize: 1024,
  uploadedBy: { _id: "user-1", name: "Alice" },
  createdAt: "2024-01-15T00:00:00.000Z",
};

const renderPanel = (props = {}) =>
  render(
    <AttachmentPanel
      meetingId="meeting-1"
      userRole="member"
      currentUserId="user-1"
      {...props}
    />,
  );

describe("AttachmentPanel accessibility & Inline Preview (#2253)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes accessible names for icon-only attachment actions including preview", async () => {
    attachmentApi.getAttachments.mockResolvedValue({
      data: {
        success: true,
        attachments: [SAMPLE_ATTACHMENT],
      },
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText("agenda.pdf")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Preview attachment agenda.pdf" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download attachment agenda.pdf" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete attachment agenda.pdf" }),
    ).toBeInTheDocument();
  });

  it("opens inline preview modal when preview is clicked and closes on close button", async () => {
    attachmentApi.getAttachments.mockResolvedValue({
      data: {
        success: true,
        attachments: [
          {
            _id: "att-img",
            fileName: "architecture.png",
            mimeType: "image/png",
            fileSize: 2048,
            uploadedBy: { name: "Bob" },
            createdAt: "2024-01-16T00:00:00.000Z",
          },
        ],
      },
    });
    attachmentApi.previewAttachment.mockResolvedValue({
      data: new ArrayBuffer(8),
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText("architecture.png")).toBeInTheDocument();
    });

    // Click preview
    fireEvent.click(
      screen.getByRole("button", {
        name: "Preview attachment architecture.png",
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "Attachment Preview Dialog" }),
      ).toBeInTheDocument();
    });

    // Close preview
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));

    expect(
      screen.queryByRole("dialog", { name: "Attachment Preview Dialog" }),
    ).not.toBeInTheDocument();
  });

  it("applies dark mode CSS classes for complete theme support", async () => {
    attachmentApi.getAttachments.mockResolvedValue({
      data: { success: true, attachments: [] },
    });

    const { container } = renderPanel();

    await waitFor(() => {
      expect(screen.getByText("No attachments yet")).toBeInTheDocument();
    });

    const rootElement = container.firstChild;
    expect(rootElement).toHaveClass("dark:bg-slate-900");
    expect(rootElement).toHaveClass("dark:border-slate-800");
  });
});

describe("AttachmentPanel (#1988)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attachmentApi.getAttachments.mockResolvedValue({
      data: { success: true, attachments: [] },
    });
  });

  it("shows a loading state while attachments are fetched", () => {
    attachmentApi.getAttachments.mockImplementation(
      () => new Promise(() => {}),
    );

    renderPanel();

    expect(screen.getByLabelText(/loading attachments/i)).toBeInTheDocument();
    expect(screen.getByTestId("attachment-panel")).toHaveAttribute(
      "data-meeting-id",
      "meeting-1",
    );
    expect(attachmentApi.getAttachments).toHaveBeenCalledWith("meeting-1");
  });

  it("shows an empty state when the meeting has no attachments", async () => {
    renderPanel();

    expect(
      await screen.findByTestId("attachment-panel-empty"),
    ).toHaveTextContent(/no attachments yet/i);
  });

  it("shows an error state when listing attachments fails", async () => {
    attachmentApi.getAttachments.mockRejectedValue({
      response: { data: { message: "Server Error" } },
    });

    renderPanel();

    expect(await screen.findByRole("alert")).toHaveTextContent("Server Error");
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Server Error");
  });

  it("shows a forbidden state when the API denies access", async () => {
    attachmentApi.getAttachments.mockRejectedValue({
      response: {
        status: 403,
        data: { message: "Forbidden: You don't have access to this resource" },
      },
    });

    renderPanel();

    expect(
      await screen.findByTestId("attachment-panel-forbidden"),
    ).toHaveTextContent(/don't have access/i);
    expect(
      screen.queryByRole("button", { name: /upload file/i }),
    ).not.toBeInTheDocument();
  });

  it("uploads a file through attachmentApi.uploadAttachment", async () => {
    attachmentApi.uploadAttachment.mockResolvedValue({
      data: { success: true },
    });

    const { container } = renderPanel();
    await screen.findByTestId("attachment-panel-empty");

    const file = new File(["hello"], "notes.pdf", { type: "application/pdf" });
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);

    await waitFor(() => {
      expect(attachmentApi.uploadAttachment).toHaveBeenCalledWith(
        "meeting-1",
        expect.any(FormData),
        expect.any(Function),
      );
    });
    expect(toast.success).toHaveBeenCalledWith("Uploaded notes.pdf");
  });

  it("downloads an attachment through attachmentApi.downloadAttachment", async () => {
    attachmentApi.getAttachments.mockResolvedValue({
      data: { success: true, attachments: [SAMPLE_ATTACHMENT] },
    });
    attachmentApi.downloadAttachment.mockResolvedValue({
      data: new Blob(["pdf"]),
    });
    const createObjectURL = vi.fn(() => "blob:attachment");
    const revokeObjectURL = vi.fn();
    const originalCreate = window.URL.createObjectURL;
    const originalRevoke = window.URL.revokeObjectURL;
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL;

    renderPanel();
    await screen.findByText("agenda.pdf");

    fireEvent.click(
      screen.getByRole("button", { name: "Download attachment agenda.pdf" }),
    );

    await waitFor(() => {
      expect(attachmentApi.downloadAttachment).toHaveBeenCalledWith(
        "meeting-1",
        "att-1",
      );
    });
    expect(createObjectURL).toHaveBeenCalled();
    window.URL.createObjectURL = originalCreate;
    window.URL.revokeObjectURL = originalRevoke;
  });

  it("deletes an attachment after confirmation", async () => {
    attachmentApi.getAttachments.mockResolvedValue({
      data: { success: true, attachments: [SAMPLE_ATTACHMENT] },
    });
    attachmentApi.deleteAttachment.mockResolvedValue({
      data: { success: true },
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPanel();
    await screen.findByText("agenda.pdf");

    fireEvent.click(
      screen.getByRole("button", { name: "Delete attachment agenda.pdf" }),
    );

    await waitFor(() => {
      expect(attachmentApi.deleteAttachment).toHaveBeenCalledWith(
        "meeting-1",
        "att-1",
      );
    });
    confirmSpy.mockRestore();
  });

  it("hides upload and delete for viewers who did not upload the file", async () => {
    attachmentApi.getAttachments.mockResolvedValue({
      data: { success: true, attachments: [SAMPLE_ATTACHMENT] },
    });

    renderPanel({ userRole: "viewer", currentUserId: "viewer-9" });

    await screen.findByText("agenda.pdf");
    expect(
      screen.queryByRole("button", { name: /upload file/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete attachment agenda.pdf" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download attachment agenda.pdf" }),
    ).toBeInTheDocument();
  });

  it("hides download for guests", async () => {
    attachmentApi.getAttachments.mockResolvedValue({
      data: { success: true, attachments: [SAMPLE_ATTACHMENT] },
    });

    renderPanel({ userRole: "guest", currentUserId: "guest-1" });

    await screen.findByText("agenda.pdf");
    expect(
      screen.queryByRole("button", { name: "Download attachment agenda.pdf" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /upload file/i }),
    ).not.toBeInTheDocument();
  });
});
