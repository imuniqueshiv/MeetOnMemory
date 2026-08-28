import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SessionGallery from "../SessionGallery";
import { sessionCardApi } from "../../services";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="mock-navbar">Navbar</div>,
}));

vi.mock("../../services", () => ({
  sessionCardApi: {
    getSessionCards: vi.fn(),
    deleteSessionCard: vi.fn(),
  },
}));

describe("SessionGallery Component (#2257)", () => {
  const mockSessions = [
    {
      _id: "s1",
      sessionTitle: "AI in Clinical Healthcare",
      eventName: "HealthTech 2026",
      speaker: "Dr. Sarah Connor",
      speakerTitle: "Chief Medical Scientist",
      speakerBio: "Leading researcher in AI diagnosis",
      summary: "Overview of deep learning diagnostic pipelines and compliance.",
      keywords: ["HealthAI", "DeepLearning", "Clinical"],
      videoUrl: "https://example.com/video1.mp4",
      createdAt: new Date().toISOString(),
    },
    {
      _id: "s2",
      sessionTitle: "Distributed Cloud Infrastructure",
      eventName: "CloudSummit 2026",
      speaker: "Alex Rivera",
      speakerTitle: "Cloud Architect",
      speakerBio: "Kubernetes core contributor",
      summary: "Strategies for multi-region active-active cloud topologies.",
      keywords: ["Kubernetes", "Cloud", "DevOps"],
      videoUrl: null,
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders gallery header, stats, and session cards", async () => {
    sessionCardApi.getSessionCards.mockResolvedValue({
      data: {
        success: true,
        data: {
          sessions: mockSessions,
          pagination: { total: 2, page: 1, limit: 24, totalPages: 1 },
        },
      },
    });

    render(
      <MemoryRouter>
        <SessionGallery />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Organization Session Cards"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("AI in Clinical Healthcare")).toBeInTheDocument();
    expect(
      screen.getByText("Distributed Cloud Infrastructure"),
    ).toBeInTheDocument();
    expect(screen.getByText("Dr. Sarah Connor")).toBeInTheDocument();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
  });

  it("handles search input filtering", async () => {
    sessionCardApi.getSessionCards.mockResolvedValue({
      data: {
        success: true,
        data: {
          sessions: [mockSessions[0]],
          pagination: { total: 1, page: 1, limit: 24, totalPages: 1 },
        },
      },
    });

    render(
      <MemoryRouter>
        <SessionGallery />
      </MemoryRouter>,
    );

    const searchInput = screen.getByPlaceholderText(
      /Search session title, speaker, event, or keyword.../i,
    );
    fireEvent.change(searchInput, { target: { value: "Clinical" } });

    await waitFor(() => {
      expect(sessionCardApi.getSessionCards).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "Clinical",
        }),
      );
    });
  });

  it("deletes a session card with confirmation", async () => {
    sessionCardApi.getSessionCards.mockResolvedValue({
      data: {
        success: true,
        data: {
          sessions: mockSessions,
          pagination: { total: 2, page: 1, limit: 24, totalPages: 1 },
        },
      },
    });
    sessionCardApi.deleteSessionCard.mockResolvedValue({
      data: { success: true },
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <MemoryRouter>
        <SessionGallery />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("AI in Clinical Healthcare")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", {
      name: /Delete session card/i,
    });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(sessionCardApi.deleteSessionCard).toHaveBeenCalledWith("s1");
    });
  });

  it("renders empty state when no session cards exist", async () => {
    sessionCardApi.getSessionCards.mockResolvedValue({
      data: {
        success: true,
        data: {
          sessions: [],
          pagination: { total: 0, page: 1, limit: 24, totalPages: 1 },
        },
      },
    });

    render(
      <MemoryRouter>
        <SessionGallery />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("No session cards found")).toBeInTheDocument();
    });
  });
});
