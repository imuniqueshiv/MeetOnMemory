import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import StandupReports from "../StandupReports";
import api from "../../services/apiClient";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../components/Navbar", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("../../services/apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe("StandupReports (#2426)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockReport = {
    _id: "rep_1",
    type: "daily",
    date: "2026-08-26T10:00:00.000Z",
    aiSummary: "Completed authentication and worked on test coverage.",
    completedActionItems: [{ text: "Fix OAuth redirect" }],
    upcomingActionItems: [{ text: "Implement Topic Dashboard" }],
    blockers: [{ text: "Blocked by API rate limit" }],
    attendedMeetings: [{ title: "Sprint Standup" }],
  };

  it("renders personal standup reports and copy buttons", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/api/standups/my") {
        return Promise.resolve({ data: { success: true, data: [mockReport] } });
      }
      if (url === "/api/standups/team") {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url === "/api/standups/preferences") {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              scheduleType: "daily",
              timeOfDay: "09:00",
              deliveryChannels: ["in-app"],
            },
          },
        });
      }
      return Promise.resolve({ data: { success: true } });
    });

    render(<StandupReports />);

    await waitFor(() => {
      expect(screen.getByText("Async Standup Reports")).toBeInTheDocument();
    });

    expect(screen.getByTestId("standup-report-card")).toBeInTheDocument();
    expect(screen.getByText("Fix OAuth redirect")).toBeInTheDocument();
    expect(screen.getByText("Implement Topic Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Blocked by API rate limit")).toBeInTheDocument();
    expect(screen.getByTestId("copy-slack-button")).toBeInTheDocument();
    expect(screen.getByTestId("copy-markdown-button")).toBeInTheDocument();
  });

  it("triggers manual standup report generation when button is clicked", async () => {
    api.get.mockResolvedValue({ data: { success: true, data: [] } });
    api.post.mockResolvedValue({ data: { success: true, data: mockReport } });

    render(<StandupReports />);

    await waitFor(() => {
      expect(screen.getByTestId("generate-standup-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("generate-standup-button"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/api/standups/generate", {
        type: "daily",
      });
    });
  });
});
