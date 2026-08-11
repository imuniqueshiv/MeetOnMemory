import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import RecapScheduleDashboard from "../RecapScheduleDashboard.jsx";
import AppContent from "../../context/AppContent.js";
import { RBACProvider } from "../../context/RBACContext.jsx";
import { ThemeProvider } from "../../context/ThemeContext.jsx";
import { recapScheduleApi } from "../../services/recapScheduleApi.js";

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({ user: null }),
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../services/recapScheduleApi.js", () => ({
  recapScheduleApi: {
    getSchedule: vi
      .fn()
      .mockResolvedValue({ data: { scheduleType: "daily", timezone: "UTC" } }),
    getDeliveryHistory: vi.fn().mockResolvedValue({ data: [] }),
    upsertSchedule: vi.fn(),
  },
}));

const mockUserData = {
  organization: { _id: "org-123", name: "Engineering Org" },
};

describe("RecapScheduleDashboard Date & Timezone Validation (#1308)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents submission when start date is set in the past", async () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AppContent.Provider value={{ userData: mockUserData }}>
            <RBACProvider>
              <RecapScheduleDashboard />
            </RBACProvider>
          </AppContent.Provider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /save preferences/i }),
      ).toBeInTheDocument();
    });

    const startDateInput = screen.getByLabelText(/start date/i);
    fireEvent.change(startDateInput, { target: { value: "2020-01-01" } });

    const saveBtn = screen.getByRole("button", { name: /save preferences/i });
    fireEvent.click(saveBtn);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Start date cannot be in the past.",
    );
    expect(recapScheduleApi.upsertSchedule).not.toHaveBeenCalled();
  });

  it("prevents submission when end date is before start date", async () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AppContent.Provider value={{ userData: mockUserData }}>
            <RBACProvider>
              <RecapScheduleDashboard />
            </RBACProvider>
          </AppContent.Provider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /save preferences/i }),
      ).toBeInTheDocument();
    });

    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);

    fireEvent.change(startDateInput, { target: { value: "2026-12-10" } });
    fireEvent.change(endDateInput, { target: { value: "2026-12-01" } });

    const saveBtn = screen.getByRole("button", { name: /save preferences/i });
    fireEvent.click(saveBtn);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "End date must be on or after start date.",
    );
    expect(recapScheduleApi.upsertSchedule).not.toHaveBeenCalled();
  });
});
