import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Profile from "../Profile.jsx";
import AppContent from "../../context/AppContent.js";
import { apiClient } from "../../services";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar">Navbar</div>,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../services", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    apiClient: {
      get: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
      post: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    },
    userApi: {
      uploadAvatar: vi.fn(),
      updateProfile: vi.fn(),
    },
  };
});

describe("Profile gamification fetch", () => {
  const mockUserData = {
    name: "Alex Doe",
    email: "alex@example.com",
    role: "Admin",
    bio: "Passionate software engineer building real-time applications.",
    isAccountVerified: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls apiClient instead of raw axios to fetch gamification score", async () => {
    const gamificationData = {
      totalPoints: 1234,
      unlockedBadges: [],
    };
    apiClient.get.mockResolvedValue({
      data: { success: true, data: gamificationData },
    });

    render(
      <MemoryRouter>
        <AppContent.Provider
          value={{ userData: mockUserData, setUserData: vi.fn() }}
        >
          <Profile />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/api/gamification/score", {
        withCredentials: true,
      });
      expect(screen.getByText(/1234/i)).toBeInTheDocument();
    });
  });
});
