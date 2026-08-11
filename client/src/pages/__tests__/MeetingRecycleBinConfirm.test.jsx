import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import MeetingRecycleBin from "../MeetingRecycleBin.jsx";
import AppContent from "../../context/AppContent.js";
import { meetingApi } from "../../services/meetingApi.js";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar" />,
}));

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({ user: null }),
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock("../../services/meetingApi.js", () => ({
  meetingApi: {
    getDeletedMeetings: vi.fn(),
    restoreDeletedMeeting: vi.fn(),
    permanentlyDeleteMeeting: vi.fn(),
  },
}));

const mockContextValue = {
  userData: { role: "admin", name: "Admin User" },
};

describe("MeetingRecycleBin Confirmation Modals (#1341)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens purge confirmation modal and permanently deletes meeting on confirm", async () => {
    meetingApi.getDeletedMeetings.mockResolvedValue({
      data: {
        meetings: [
          {
            _id: "m-1",
            title: "Sprint Planning Notes",
            deletedAt: "2026-08-01T10:00:00Z",
          },
        ],
        pagination: { page: 1, totalPages: 1 },
      },
    });
    meetingApi.permanentlyDeleteMeeting.mockResolvedValue({
      data: { success: true },
    });

    render(
      <MemoryRouter>
        <AppContent.Provider value={mockContextValue}>
          <MeetingRecycleBin />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Sprint Planning Notes")).toBeInTheDocument();
    });

    const purgeButton = screen.getByRole("button", { name: /delete forever/i });
    fireEvent.click(purgeButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/permanently delete meeting/i)).toBeInTheDocument();

    const confirmButton = screen.getAllByRole("button", {
      name: /delete forever/i,
    })[1];
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(meetingApi.permanentlyDeleteMeeting).toHaveBeenCalledWith("m-1");
    });
  });
});
