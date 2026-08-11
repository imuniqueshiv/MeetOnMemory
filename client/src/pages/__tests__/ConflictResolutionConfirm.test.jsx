import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ConflictResolution from "../ConflictResolution.jsx";
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
    getConflicts: vi.fn(),
    scanForConflicts: vi.fn(),
    resolveConflict: vi.fn(),
  },
}));

describe("ConflictResolution Confirmation Modal (#1342)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens confirmation modal before resolving conflict and calls resolveConflict API on confirm", async () => {
    knowledgeApi.getConflicts.mockResolvedValue({
      data: {
        success: true,
        conflicts: [
          {
            _id: "conflict-1",
            confidence: 90,
            explanation: "Decisions contradict regarding launch date.",
            memberSnapshots: [
              { memoryId: "mem-1", text: "Launch on Oct 1" },
              { memoryId: "mem-2", text: "Launch on Nov 1" },
            ],
          },
        ],
      },
    });
    knowledgeApi.resolveConflict.mockResolvedValue({ data: { success: true } });

    render(<ConflictResolution />);

    await waitFor(() => {
      expect(screen.getByText("Launch on Oct 1")).toBeInTheDocument();
    });

    const keepButton = screen.getAllByRole("button", { name: /keep this/i })[0];
    fireEvent.click(keepButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText(/keep selected memory version/i),
    ).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", {
      name: /confirm resolution/i,
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(knowledgeApi.resolveConflict).toHaveBeenCalledWith("conflict-1", {
        resolutionType: "kept_member",
        keptMemoryId: "mem-1",
      });
    });
  });
});
