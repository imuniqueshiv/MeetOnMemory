import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Notifications from "../Notifications.jsx";
import { notificationApi } from "../../services";
import AppContent from "../../context/AppContent";

vi.mock("../../services", () => ({
  notificationApi: {
    getNotifications: vi.fn(),
    getPreferences: vi
      .fn()
      .mockResolvedValue({ data: { success: true, preferences: {} } }),
  },
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("../../i18n.js", () => ({
  default: { t: (key) => key },
}));

vi.stubGlobal("localStorage", {
  getItem: vi.fn(),
  setItem: vi.fn(),
});

describe("Notifications Search & Deep Links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send search query to the API after debouncing", async () => {
    notificationApi.getNotifications.mockResolvedValue({
      data: {
        success: true,
        notifications: [],
        unreadCount: 0,
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
    });

    render(
      <MemoryRouter>
        <AppContent.Provider value={{ userData: { id: "123" } }}>
          <Notifications />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    const searchInput = screen.getByPlaceholderText("Search...");
    fireEvent.change(searchInput, { target: { value: "test" } });

    await waitFor(
      () => {
        expect(notificationApi.getNotifications).toHaveBeenCalledWith(
          expect.objectContaining({ search: "test" }),
        );
      },
      { timeout: 1000 },
    );
  });
});
