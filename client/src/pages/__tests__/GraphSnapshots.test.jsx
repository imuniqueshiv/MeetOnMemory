import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import GraphSnapshots from "../GraphSnapshots.jsx";
import { knowledgeApi } from "../../services";

vi.mock("../../services", () => ({
  knowledgeApi: {
    getGraphSnapshots: vi.fn(),
    diffGraphSnapshots: vi.fn(),
    createGraphSnapshot: vi.fn(),
    exportGraphSnapshot: vi.fn(),
  },
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

describe("GraphSnapshots Component with Pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders graph snapshots timeline and handles pagination load more", async () => {
    const mockPage1 = {
      data: {
        success: true,
        count: 2,
        totalCount: 4,
        hasMore: true,
        snapshots: [
          {
            _id: "snap-1",
            createdAt: "2026-07-31T10:00:00.000Z",
            trigger: "manual",
            metadata: {
              nodeCount: 10,
              edgeCount: 5,
              decisionCount: 3,
              actionItemCount: 2,
            },
          },
          {
            _id: "snap-2",
            createdAt: "2026-07-30T10:00:00.000Z",
            trigger: "meeting_processed",
            metadata: {
              nodeCount: 8,
              edgeCount: 4,
              decisionCount: 2,
              actionItemCount: 1,
            },
          },
        ],
      },
    };

    const mockPage2 = {
      data: {
        success: true,
        count: 2,
        totalCount: 4,
        hasMore: false,
        snapshots: [
          {
            _id: "snap-3",
            createdAt: "2026-07-29T10:00:00.000Z",
            trigger: "consolidation",
            metadata: {
              nodeCount: 5,
              edgeCount: 2,
              decisionCount: 1,
              actionItemCount: 0,
            },
          },
          {
            _id: "snap-4",
            createdAt: "2026-07-28T10:00:00.000Z",
            trigger: "scheduled",
            metadata: {
              nodeCount: 3,
              edgeCount: 1,
              decisionCount: 1,
              actionItemCount: 0,
            },
          },
        ],
      },
    };

    knowledgeApi.getGraphSnapshots
      .mockResolvedValueOnce(mockPage1)
      .mockResolvedValueOnce(mockPage2);

    render(
      <MemoryRouter>
        <GraphSnapshots />
      </MemoryRouter>,
    );

    expect(screen.getByText("Memory Graph History")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/2 of 4/i)).toBeInTheDocument();
    });

    const loadMoreButton = screen.getByRole("button", {
      name: /Load older snapshots/i,
    });
    expect(loadMoreButton).toBeInTheDocument();

    fireEvent.click(loadMoreButton);

    await waitFor(() => {
      expect(knowledgeApi.getGraphSnapshots).toHaveBeenCalledWith({
        limit: 20,
        before: "2026-07-30T10:00:00.000Z",
      });
      expect(screen.getByText("All snapshots loaded")).toBeInTheDocument();
    });
  });
});
