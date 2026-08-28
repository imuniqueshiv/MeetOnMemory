import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import OrgTimelineDashboard from "../OrgTimelineDashboard.jsx";
import apiClient from "../../services/apiClient.js";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="app-navbar">App Navbar</div>,
}));

vi.mock("../../services/apiClient.js", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockSeriesList = [
  { _id: "series-1", title: "Engineering Weekly Sync" },
  { _id: "series-2", title: "Product Backlog Grooming" },
];

const mockTimelineData = {
  data: [
    {
      meetingId: "meet-1",
      title: "Sprint Planning",
      date: "2026-08-25T10:00:00.000Z",
      seriesName: "Engineering Weekly Sync",
      teamName: "Engineering",
      tags: ["Sprint_25", "Plan"],
      attendeeCount: 8,
      decisionCount: 3,
      actionItemCount: 5,
    },
    {
      meetingId: "meet-2",
      title: "Roadmap Alignment",
      date: "2026-08-24T14:30:00.000Z",
      seriesName: "",
      teamName: "Product Management",
      tags: ["Roadmap", "Strategy"],
      attendeeCount: 12,
      decisionCount: 5,
      actionItemCount: 2,
    },
  ],
  pagination: {
    page: 1,
    limit: 10,
    totalPages: 2,
    totalMeetings: 15,
  },
};

describe("OrgTimelineDashboard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    apiClient.get.mockImplementation((url) => {
      if (url === "/api/meeting-series") {
        return Promise.resolve({ data: mockSeriesList });
      }
      if (url === "/api/analytics/org-timeline") {
        return Promise.resolve({ data: mockTimelineData });
      }
      return Promise.reject(new Error("Unknown route"));
    });
  });

  it("renders headers, sidebar navbar, and filters", async () => {
    render(
      <MemoryRouter>
        <OrgTimelineDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("app-navbar")).toBeInTheDocument();
    expect(screen.getByText("Organization Timeline")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Executive chronological multi-meeting overview and insights",
      ),
    ).toBeInTheDocument();

    // Verify filter elements exist
    await waitFor(() => {
      expect(screen.getByLabelText("Team / Department")).toBeInTheDocument();
      expect(screen.getByLabelText("Tag")).toBeInTheDocument();
      expect(screen.getByLabelText("Meeting Series")).toBeInTheDocument();
    });
  });

  it("fetches meeting series and timeline data on mount", async () => {
    render(
      <MemoryRouter>
        <OrgTimelineDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/api/meeting-series");
      expect(apiClient.get).toHaveBeenCalledWith(
        "/api/analytics/org-timeline",
        expect.objectContaining({
          params: expect.objectContaining({ page: 1, limit: 10 }),
        }),
      );
    });

    // Check if meetings are rendered
    expect(screen.getByText("Sprint Planning")).toBeInTheDocument();
    expect(screen.getByText("Roadmap Alignment")).toBeInTheDocument();
  });

  it("applies filters correctly and triggers new api call", async () => {
    render(
      <MemoryRouter>
        <OrgTimelineDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Sprint Planning")).toBeInTheDocument();
    });

    // Trigger Team filter change
    const teamSelect = screen.getByLabelText("Team / Department");
    fireEvent.change(teamSelect, { target: { value: "team-eng" } });

    // Trigger Tag input change
    const tagInput = screen.getByLabelText("Tag");
    fireEvent.change(tagInput, { target: { value: "Sprint_25" } });

    // Trigger Series filter change
    const seriesSelect = screen.getByLabelText("Meeting Series");
    fireEvent.change(seriesSelect, { target: { value: "series-1" } });

    // Verify new API request was made with modified parameters
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenLastCalledWith(
        "/api/analytics/org-timeline",
        expect.objectContaining({
          params: expect.objectContaining({
            teamId: "team-eng",
            tag: "Sprint_25",
            seriesId: "series-1",
            page: 1,
          }),
        }),
      );
    });
  });

  it("resets filters on clicking clear filters", async () => {
    render(
      <MemoryRouter>
        <OrgTimelineDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Sprint Planning")).toBeInTheDocument();
    });

    // Set filters
    fireEvent.change(screen.getByLabelText("Team / Department"), {
      target: { value: "team-eng" },
    });
    fireEvent.change(screen.getByLabelText("Tag"), {
      target: { value: "Sprint_25" },
    });

    // Click clear filters button
    const clearBtn = screen.getByText("Clear Filters");
    fireEvent.click(clearBtn);

    // Verify filters are reset
    expect(screen.getByLabelText("Team / Department").value).toBe("");
    expect(screen.getByLabelText("Tag").value).toBe("");
  });

  it("navigates pagination pages correctly", async () => {
    render(
      <MemoryRouter>
        <OrgTimelineDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenLastCalledWith(
        "/api/analytics/org-timeline",
        expect.objectContaining({
          params: expect.objectContaining({ page: 2 }),
        }),
      );
    });
  });
});
