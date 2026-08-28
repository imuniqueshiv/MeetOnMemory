import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import Notifications from "../Notifications";
import AppContent from "../../context/AppContent";
import * as useKeywordAlertsHook from "../../hooks/useKeywordAlerts";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../components/Navbar", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("../../components/NudgeInbox", () => ({
  default: () => <div data-testid="nudge-inbox">NudgeInbox</div>,
}));

describe("Notifications Keyword Watchlist Tab Integration (#2424)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useKeywordAlertsHook, "useKeywordAlerts").mockReturnValue({
      watchlist: {
        keywords: ["Sprint", "Budget"],
        notifyViaEmail: true,
        notifyViaApp: true,
        isActive: true,
      },
      history: [],
      loading: false,
      historyLoading: false,
      error: null,
      updateWatchlist: vi.fn(),
      toggleAlerts: vi.fn(),
      testSendAlert: vi.fn(),
      clearHistory: vi.fn(),
      refreshHistory: vi.fn(),
    });
  });

  const renderComponent = () => {
    const mockContext = {
      userData: {
        _id: "u_1",
        email: "user@example.com",
        currentOrganization: "org_1",
      },
    };

    return render(
      <BrowserRouter>
        <AppContent.Provider value={mockContext}>
          <Notifications />
        </AppContent.Provider>
      </BrowserRouter>,
    );
  };

  it("renders both All Notifications and Keyword Watchlist tabs", () => {
    renderComponent();

    expect(
      screen.getByRole("tab", { name: /All Notifications/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Keyword Watchlist/i }),
    ).toBeInTheDocument();
  });

  it("switches to Keyword Watchlist tab when clicked", () => {
    renderComponent();

    const keywordTab = screen.getByTestId("tab-keyword-watchlist");
    fireEvent.click(keywordTab);

    expect(keywordTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByText("Keyword Watchlist").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Monitored Keywords & Phrases/i),
    ).toBeInTheDocument();
  });
});
