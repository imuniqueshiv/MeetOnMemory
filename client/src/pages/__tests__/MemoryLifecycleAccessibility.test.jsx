import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import MemoryLifecycle from "../MemoryLifecycle.jsx";
import { knowledgeApi } from "../../services";

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

vi.mock("../../services", () => ({
  knowledgeApi: {
    getDecisions: vi.fn(),
    getActionItems: vi.fn(),
    runLifecycleSweep: vi.fn(),
    updateMemoryLifecycleState: vi.fn(),
  },
}));

describe("MemoryLifecycle Modal Accessibility (#1368)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    knowledgeApi.getDecisions.mockResolvedValue({
      data: {
        success: true,
        decisions: [
          {
            _id: "dec-1",
            text: "Adopt React 18 for client application",
            lifecycleState: "active",
            createdAt: "2026-08-01T10:00:00Z",
            lifecycleHistory: [],
          },
        ],
      },
    });
    knowledgeApi.getActionItems.mockResolvedValue({
      data: { success: true, actionItems: [] },
    });
  });

  it("exposes WAI-ARIA dialog attributes when opening state transition modal", async () => {
    render(
      <MemoryRouter>
        <MemoryLifecycle />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Adopt React 18 for client application"),
      ).toBeInTheDocument();
    });

    const archiveButton = screen.getByRole("button", { name: /^archive$/i });
    fireEvent.click(archiveButton);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "transition-modal-title");
  });

  it("closes open modal on Escape key press", async () => {
    render(
      <MemoryRouter>
        <MemoryLifecycle />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Adopt React 18 for client application"),
      ).toBeInTheDocument();
    });

    const archiveButton = screen.getByRole("button", { name: /^archive$/i });
    fireEvent.click(archiveButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
