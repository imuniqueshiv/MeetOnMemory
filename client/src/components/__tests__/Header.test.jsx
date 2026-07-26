import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";
import Header from "../Header";
import AppContent from "../../context/AppContent";

// Mock useNavigate
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

// Mock assets
vi.mock("../../assets/assets", () => ({
  assets: {
    header_img: "header_img.png",
    hand_wave: "hand_wave.png",
  },
}));

describe("Header Component", () => {
  it("renders default text when user is not logged in", () => {
    const mockContext = { userData: null };

    render(
      <MemoryRouter>
        <AppContent.Provider value={mockContext}>
          <Header />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Hey/i)).toHaveTextContent("Hey Developer!");
  });

  it("renders user name when user is logged in", () => {
    const mockContext = { userData: { name: "Alice" } };

    render(
      <MemoryRouter>
        <AppContent.Provider value={mockContext}>
          <Header />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Hey/i)).toHaveTextContent("Hey Alice!");
  });

  it("navigates to login if not logged in and Get Started is clicked", () => {
    const mockNavigate = vi.fn();
    useNavigate.mockReturnValue(mockNavigate);

    const mockContext = { userData: null };

    render(
      <MemoryRouter>
        <AppContent.Provider value={mockContext}>
          <Header />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Get Started/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("navigates to dashboard if logged in and Get Started is clicked", () => {
    const mockNavigate = vi.fn();
    useNavigate.mockReturnValue(mockNavigate);

    const mockContext = { userData: { name: "Alice" } };

    render(
      <MemoryRouter>
        <AppContent.Provider value={mockContext}>
          <Header />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Get Started/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });
});
