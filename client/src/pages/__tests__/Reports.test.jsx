import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Reports from "../Reports.jsx";
import { analyticsApi } from "../../services";

vi.mock("../../services", () => ({
  analyticsApi: {
    getAnalytics: vi.fn(),
    askAnalyticsChat: vi.fn(),
  },
}));

vi.mock("../../services/reportApi.js", () => ({
  default: {
    getTemplates: vi.fn().mockResolvedValue({ data: [] }),
    getTemplateById: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    generateReport: vi.fn(),
  },
}));

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("react-chartjs-2", () => ({
  Line: () => <div data-testid="line-chart">Line Chart</div>,
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
  Pie: () => <div data-testid="pie-chart">Pie Chart</div>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, fallback) => (typeof fallback === "string" ? fallback : key),
  }),
}));

describe("Reports Component (Issue #914)", () => {
  const mockAnalyticsData = {
    data: {
      success: true,
      summary: {
        totalMeetings: 15,
        completedMeetings: 12,
        totalPolicies: 5,
        updatedPolicies: 3,
      },
      trends: {
        monthlyMeetings: [{ _id: 7, count: 12 }],
        monthlyPolicies: [{ _id: 7, count: 3 }],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads analytics without automatically triggering AI insights on mount", async () => {
    analyticsApi.getAnalytics.mockResolvedValueOnce(mockAnalyticsData);

    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(analyticsApi.getAnalytics).toHaveBeenCalledTimes(1);
    });

    expect(analyticsApi.askAnalyticsChat).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /Generate AI Insights/i }),
    ).toBeInTheDocument();
  });

  it("generates AI insights only when user clicks the Generate AI Insights button", async () => {
    analyticsApi.getAnalytics.mockResolvedValueOnce(mockAnalyticsData);
    analyticsApi.askAnalyticsChat.mockResolvedValueOnce({
      data: {
        success: true,
        insight:
          "Your meeting completion rate is 80%. Great productivity trend!",
      },
    });

    render(
      <MemoryRouter>
        <Reports />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Generate AI Insights/i }),
      ).toBeInTheDocument();
    });

    const generateButton = screen.getByRole("button", {
      name: /Generate AI Insights/i,
    });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(analyticsApi.askAnalyticsChat).toHaveBeenCalledWith({
        summary: mockAnalyticsData.data.summary,
      });
      expect(
        screen.getByText(
          "Your meeting completion rate is 80%. Great productivity trend!",
        ),
      ).toBeInTheDocument();
    });
  });
});
