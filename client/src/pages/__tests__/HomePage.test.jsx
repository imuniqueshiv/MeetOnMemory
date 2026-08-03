import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import HomePage from "../HomePage";
import AppContent from "../../context/AppContent";

// Mock i18next translation
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { changeLanguage: () => Promise.resolve() },
  }),
}));

// Mock useRBAC hook
vi.mock("../../hooks/useRBAC.js", () => ({
  useRBAC: () => ({
    hasPermission: () => true,
    userRole: "admin",
  }),
}));

// Mock useTheme default export
vi.mock("../../context/useTheme.jsx", () => ({
  default: () => ({
    theme: "light",
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
    mounted: true,
  }),
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
    mounted: true,
  }),
}));

const mockNotes = [
  {
    id: "1",
    title: "Sprint Planning Notes",
    content: "Discussed Q3 goals and roadmap priorities.",
    tags: ["sprint", "agile"],
    createdAt: "2026-08-01T10:00:00Z",
  },
  {
    id: "2",
    title: "Security Review",
    content: "Audited auth headers and JWT tokens.",
    tags: ["security", "auth"],
    createdAt: "2026-08-02T11:00:00Z",
  },
];

const mockContextValue = {
  backendUrl: "http://localhost:4000",
  userData: { name: "Test User", email: "test@example.com" },
  setUserData: vi.fn(),
  setIsLoggedin: vi.fn(),
  getUserData: vi.fn(),
};

const renderHomePage = (notes = mockNotes) => {
  return render(
    <AppContent.Provider value={mockContextValue}>
      <BrowserRouter>
        <HomePage initialNotes={notes} />
      </BrowserRouter>
    </AppContent.Provider>,
  );
};

describe("HomePage Real-time Search & Filter", () => {
  it("renders all initial notes when search is empty", () => {
    renderHomePage();
    expect(screen.getByText("Sprint Planning Notes")).toBeInTheDocument();
    expect(screen.getByText("Security Review")).toBeInTheDocument();
  });

  it("filters notes in real-time by title", () => {
    renderHomePage();
    const searchInput = screen.getByRole("searchbox", {
      name: /search notes/i,
    });

    fireEvent.change(searchInput, { target: { value: "Sprint" } });
    expect(screen.getByText("Sprint Planning Notes")).toBeInTheDocument();
    expect(screen.queryByText("Security Review")).not.toBeInTheDocument();
  });

  it("filters notes in real-time by content", () => {
    renderHomePage();
    const searchInput = screen.getByRole("searchbox", {
      name: /search notes/i,
    });

    fireEvent.change(searchInput, { target: { value: "JWT tokens" } });
    expect(screen.getByText("Security Review")).toBeInTheDocument();
    expect(screen.queryByText("Sprint Planning Notes")).not.toBeInTheDocument();
  });

  it("renders empty state when no notes match search query", () => {
    renderHomePage();
    const searchInput = screen.getByRole("searchbox", {
      name: /search notes/i,
    });

    fireEvent.change(searchInput, { target: { value: "nonexistent query" } });
    expect(screen.getByText("No matching notes found")).toBeInTheDocument();
  });

  it("clears search and restores all notes when Clear Search button is clicked", () => {
    renderHomePage();
    const searchInput = screen.getByRole("searchbox", {
      name: /search notes/i,
    });

    fireEvent.change(searchInput, { target: { value: "nonexistent query" } });
    const clearButtons = screen.getAllByRole("button", {
      name: /clear search/i,
    });
    fireEvent.click(clearButtons[0]);

    expect(screen.getByText("Sprint Planning Notes")).toBeInTheDocument();
    expect(screen.getByText("Security Review")).toBeInTheDocument();
  });
});
