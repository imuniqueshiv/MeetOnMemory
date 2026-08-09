import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CalendarIntegrations from "../CalendarIntegrations.jsx";
import apiClient from "../../services/apiClient.js";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("CalendarIntegrations Disconnect Confirmation (#1304)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prompts confirmation modal before executing disconnect request", async () => {
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        integrations: [
          {
            provider: "google",
            syncEnabled: true,
            syncStatus: "connected",
            lastSyncedAt: "2026-08-01T12:00:00.000Z",
          },
        ],
      },
    });

    apiClient.post.mockResolvedValue({
      data: { success: true },
    });

    render(<CalendarIntegrations />);

    await waitFor(() => {
      expect(screen.getByText("Google Calendar")).toBeInTheDocument();
    });

    const disconnectBtn = screen.getByRole("button", { name: /disconnect/i });
    fireEvent.click(disconnectBtn);

    // ConfirmModal should appear
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByText("Disconnect Calendar Integration"),
    ).toBeInTheDocument();

    // Confirming disconnect inside dialog should trigger POST request
    const modalConfirmBtn = within(dialog).getByRole("button", {
      name: /disconnect/i,
    });
    fireEvent.click(modalConfirmBtn);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/calendar/disconnect/google",
    );
  });
});
