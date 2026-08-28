import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DigestActions from "../DigestActions.jsx";
import { meetingApi } from "../../../services";
import { toast } from "react-toastify";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../services", () => ({
  meetingApi: {
    getDigestStatus: vi.fn(),
    previewDigest: vi.fn(),
    resendDigest: vi.fn(),
  },
}));

vi.mock("../../SandboxedHtmlPreview.jsx", () => ({
  default: ({ htmlContent, title }) => (
    <div data-testid="digest-html-preview" title={title}>
      {htmlContent}
    </div>
  ),
}));

const MEETING_ID = "meeting-123";

const renderActions = (props = {}) =>
  render(<DigestActions meetingId={MEETING_ID} canManage {...props} />);

describe("DigestActions (#1990)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meetingApi.getDigestStatus.mockRejectedValue({ response: { status: 404 } });
  });

  it("shows a loading status while the optional last-sent payload is fetched", () => {
    meetingApi.getDigestStatus.mockImplementation(() => new Promise(() => {}));

    renderActions();

    expect(screen.getByLabelText(/loading digest status/i)).toBeInTheDocument();
    expect(screen.getByTestId("digest-actions")).toHaveAttribute(
      "data-meeting-id",
      MEETING_ID,
    );
  });

  it("shows last-sent status when the status API provides it", async () => {
    meetingApi.getDigestStatus.mockResolvedValue({
      data: {
        success: true,
        data: {
          lastStatus: "delivered",
          lastDeliveredAt: "2026-08-01T12:00:00.000Z",
          totalDelivered: 3,
          totalFailed: 0,
        },
      },
    });

    renderActions();

    expect(await screen.findByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText(/3 sent/i)).toBeInTheDocument();
  });

  it("shows an empty last-sent state when status is unavailable", async () => {
    renderActions();

    expect(await screen.findByText("No delivery recorded")).toBeInTheDocument();
    expect(screen.getByText(/0 sent/i)).toBeInTheDocument();
  });

  it("previews HTML and text from the digest preview API", async () => {
    meetingApi.previewDigest.mockResolvedValue({
      data: "<html><body><p>Weekly recap</p></body></html>",
    });

    renderActions();
    await screen.findByText("No delivery recorded");

    fireEvent.click(screen.getByRole("button", { name: /preview/i }));

    expect(await screen.findByTestId("digest-html-preview")).toHaveTextContent(
      "Weekly recap",
    );
    expect(meetingApi.previewDigest).toHaveBeenCalledWith(MEETING_ID);

    fireEvent.click(screen.getByRole("button", { name: /^text$/i }));
    expect(screen.getByTestId("digest-preview-text")).toHaveTextContent(
      "Weekly recap",
    );
  });

  it("shows an error when the preview API fails", async () => {
    meetingApi.previewDigest.mockRejectedValue({
      response: { status: 500, data: { message: "Preview unavailable" } },
    });

    renderActions();
    await screen.findByText("No delivery recorded");

    fireEvent.click(screen.getByRole("button", { name: /preview/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Preview unavailable",
    );
  });

  it("resends the digest through meetingApi.resendDigest", async () => {
    meetingApi.resendDigest.mockResolvedValue({
      data: { success: true, message: "Digest sent to 2 participant(s)." },
    });

    renderActions();
    await screen.findByText("No delivery recorded");

    fireEvent.click(screen.getByRole("button", { name: /resend digest/i }));

    await waitFor(() => {
      expect(meetingApi.resendDigest).toHaveBeenCalledWith(MEETING_ID);
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Digest sent to 2 participant(s).",
    );
  });

  it("reports when delivery is disabled by email/digest preferences", async () => {
    meetingApi.resendDigest.mockRejectedValue({
      response: {
        status: 400,
        data: {
          success: false,
          message: "All participants with emails have opted out of digests.",
        },
      },
    });

    renderActions();
    await screen.findByText("No delivery recorded");

    fireEvent.click(screen.getByRole("button", { name: /resend digest/i }));

    expect(
      await screen.findByTestId("digest-delivery-disabled"),
    ).toHaveTextContent(/opted out of digests/i);
  });

  it("shows an error state when resend fails", async () => {
    meetingApi.resendDigest.mockRejectedValue({
      response: { status: 500, data: { message: "Server Error" } },
    });

    renderActions();
    await screen.findByText("No delivery recorded");

    fireEvent.click(screen.getByRole("button", { name: /resend digest/i }));

    expect(await screen.findByTestId("digest-actions-error")).toHaveTextContent(
      "Server Error",
    );
  });

  it("does not render actions when the user cannot manage digests", () => {
    renderActions({ canManage: false });

    expect(screen.queryByTestId("digest-actions")).not.toBeInTheDocument();
    expect(meetingApi.getDigestStatus).not.toHaveBeenCalled();
  });
});
