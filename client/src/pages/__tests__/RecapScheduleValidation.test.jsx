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
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("../../services/recapScheduleApi.js", () => ({
  recapScheduleApi: {
    getSchedule: vi
      .fn()
      .mockResolvedValue({ data: { scheduleType: "daily", timezone: "UTC" } }),
    getDeliveryHistory: vi.fn().mockResolvedValue({ data: [] }),
    upsertSchedule: vi.fn(),
    retryDelivery: vi.fn(),
  },
}));

const mockUserData = {
  organization: { _id: "org-123", name: "Engineering Org" },
};
const renderDashboard = () =>
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

describe("RecapScheduleDashboard Date & Timezone Validation (#1308)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recapScheduleApi.getSchedule.mockResolvedValue({
      data: { scheduleType: "daily", timezone: "UTC" },
    });
    recapScheduleApi.getDeliveryHistory.mockResolvedValue({ data: [] });
  });

  it("prevents submission when start date is set in the past", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /save preferences/i }),
      ).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: "2020-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save preferences/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Start date cannot be in the past.",
    );
    expect(recapScheduleApi.upsertSchedule).not.toHaveBeenCalled();
  });

  it("prevents submission when end date is before start date", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /save preferences/i }),
      ).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText(/start date/i), {
      target: { value: "2026-12-10" },
    });
    fireEvent.change(screen.getByLabelText(/end date/i), {
      target: { value: "2026-12-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save preferences/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "End date must be on or after start date.",
    );
    expect(recapScheduleApi.upsertSchedule).not.toHaveBeenCalled();
  });
});

describe("RecapScheduleDashboard Retry Feedback (#1524)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recapScheduleApi.getSchedule.mockResolvedValue({
      data: { scheduleType: "daily", timezone: "UTC" },
    });
  });

  it("shows inline success feedback when a retry is enqueued", async () => {
    recapScheduleApi.getDeliveryHistory.mockResolvedValue({
      data: [
        {
          _id: "delivery-1",
          deliveredAt: "2026-08-14T10:00:00.000Z",
          meetingId: { title: "Weekly Sync" },
        },
      ],
    });
    recapScheduleApi.retryDelivery.mockResolvedValue({
      data: { queued: true },
    });
    const alertSpy = vi.spyOn(window, "alert");
    renderDashboard();
    fireEvent.click(
      await screen.findByRole("button", {
        name: /retry delivery for weekly sync/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry Delivery" }));
    await waitFor(() => {
      expect(recapScheduleApi.retryDelivery).toHaveBeenCalledWith("delivery-1");
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Retry enqueued successfully.",
      );
    });
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("shows a friendly inline error without exposing the backend error", async () => {
    recapScheduleApi.getDeliveryHistory.mockResolvedValue({
      data: [
        {
          _id: "delivery-2",
          deliveredAt: "2026-08-14T10:00:00.000Z",
          meetingId: { title: "Planning Review" },
        },
      ],
    });
    recapScheduleApi.retryDelivery.mockRejectedValue(
      new Error("500: queue connection failed; internal token=secret"),
    );
    const alertSpy = vi.spyOn(window, "alert");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderDashboard();
    fireEvent.click(
      await screen.findByRole("button", {
        name: /retry delivery for planning review/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry Delivery" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "We couldn't enqueue the retry. Please try again.",
      ),
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "queue connection failed",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("secret");
    expect(alertSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("disables the retry action while the request is pending", async () => {
    let resolveRetry;
    recapScheduleApi.getDeliveryHistory.mockResolvedValue({
      data: [
        {
          _id: "delivery-3",
          deliveredAt: "2026-08-14T10:00:00.000Z",
          meetingId: { title: "Standup" },
        },
      ],
    });
    recapScheduleApi.retryDelivery.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRetry = resolve;
        }),
    );
    renderDashboard();
    const retryButton = await screen.findByRole("button", {
      name: /retry delivery for standup/i,
    });
    fireEvent.click(retryButton);
    fireEvent.click(screen.getByRole("button", { name: "Retry Delivery" }));
    await waitFor(() => {
      expect(recapScheduleApi.retryDelivery).toHaveBeenCalledTimes(1);
      expect(retryButton).toBeDisabled();
      expect(retryButton).toHaveTextContent("Retrying...");
    });
    resolveRetry({ data: { queued: true } });
    await waitFor(() => {
      expect(retryButton).not.toBeDisabled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Retry enqueued successfully.",
      );
    });
  });
});
