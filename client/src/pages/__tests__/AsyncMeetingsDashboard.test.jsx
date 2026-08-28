import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import AsyncMeetingsDashboard from "../AsyncMeetingsDashboard";
import apiClient from "../../services/apiClient";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../services/apiClient", () => {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(),
    },
  };
});
vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar" />,
}));

describe("AsyncMeetingsDashboard", () => {
  const mockMeetings = [
    {
      _id: "1",
      title: "Daily Standup Async",
      status: "pending",
      creator: { name: "Alice" },
      deadline: new Date(Date.now() + 86400000).toISOString(),
    },
    {
      _id: "2",
      title: "Weekly Sync Async",
      status: "completed",
      creator: { name: "Bob" },
      deadline: new Date(Date.now() - 86400000).toISOString(),
      aiSummary: "This is a test summary.",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", async () => {
    apiClient.get.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );
    render(
      <MemoryRouter>
        <AsyncMeetingsDashboard />
      </MemoryRouter>,
    );
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders pending meetings", async () => {
    apiClient.get.mockResolvedValue({ data: mockMeetings });
    render(
      <MemoryRouter>
        <AsyncMeetingsDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Daily Standup Async")).toBeInTheDocument();
    });

    expect(screen.getByText("Submit Update")).toBeInTheDocument();
  });

  it("renders completed meetings when tab is clicked", async () => {
    apiClient.get.mockResolvedValue({ data: mockMeetings });
    render(
      <MemoryRouter>
        <AsyncMeetingsDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Daily Standup Async")).toBeInTheDocument();
    });

    const completedTab = screen.getByText("Completed Summaries");
    completedTab.click();

    await waitFor(() => {
      expect(screen.getByText("Weekly Sync Async")).toBeInTheDocument();
    });

    expect(screen.getByText("This is a test summary.")).toBeInTheDocument();
  });
});
