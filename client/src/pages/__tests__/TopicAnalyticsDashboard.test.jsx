import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import TopicAnalyticsDashboard from "../TopicAnalyticsDashboard";
import AppContent from "../../context/AppContent";
import topicApi from "../../services/topicApi";

vi.mock("../../components/Navbar", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("../../services/topicApi", () => ({
  default: {
    getTopicVelocityAndTrends: vi.fn(),
  },
}));

describe("TopicAnalyticsDashboard (#2425)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockData = {
    topics: [
      {
        name: "Kubernetes Migration",
        cluster: "Infrastructure",
        velocity: "accelerating",
        growthPercentage: 65,
        recentCount: 12,
        priorCount: 7,
        totalCount: 19,
        meetingCount: 8,
      },
      {
        name: "Q4 Budget",
        cluster: "Finance",
        velocity: "decelerating",
        growthPercentage: -40,
        recentCount: 3,
        priorCount: 5,
        totalCount: 8,
        meetingCount: 4,
      },
    ],
    metrics: {
      totalTopics: 2,
      totalMeetings: 10,
      acceleratingCount: 1,
      deceleratingCount: 1,
      activeClustersCount: 2,
    },
  };

  const renderComponent = () => {
    const mockContext = {
      userData: {
        _id: "u_1",
        currentOrganization: "org_1",
      },
    };

    return render(
      <BrowserRouter>
        <AppContent.Provider value={mockContext}>
          <TopicAnalyticsDashboard />
        </AppContent.Provider>
      </BrowserRouter>,
    );
  };

  it("renders topic metrics KPI cards and topics list", async () => {
    topicApi.getTopicVelocityAndTrends.mockResolvedValue({
      data: {
        success: true,
        data: mockData,
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText("Topic Trends & Semantic Velocity"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Kubernetes Migration")).toBeInTheDocument();
    expect(screen.getAllByText("Accelerating").length).toBeGreaterThan(0);
    expect(screen.getByText("Q4 Budget")).toBeInTheDocument();
    expect(screen.getAllByText("Decelerating").length).toBeGreaterThan(0);
  });

  it("filters topics by search query", async () => {
    topicApi.getTopicVelocityAndTrends.mockResolvedValue({
      data: {
        success: true,
        data: mockData,
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Kubernetes Migration")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      /Search topics or clusters/i,
    );
    fireEvent.change(searchInput, { target: { value: "Kubernetes" } });

    expect(screen.getByText("Kubernetes Migration")).toBeInTheDocument();
    expect(screen.queryByText("Q4 Budget")).not.toBeInTheDocument();
  });
});
