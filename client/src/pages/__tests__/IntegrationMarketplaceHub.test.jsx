import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { IntegrationMarketplaceHub } from "../IntegrationMarketplaceHub.jsx";

import apiClient from "../../services/apiClient.js";

// Mocking react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock apiClient
vi.mock("../../services/apiClient.js");

describe("IntegrationMarketplaceHub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        integrations: [
          {
            id: "jira",
            name: "Jira Issue Tracker",
            category: "Project Management",
            description: "File candidate bug tasks",
            recommendationOrder: 4,
            isConnected: true,
            configurationRoute: "/organization/settings#jira",
          },
          {
            id: "slack",
            name: "Slack Notification Core",
            category: "Communication",
            description: "Broadcast operational real-time updates",
            recommendationOrder: 1,
            isConnected: false,
            configurationRoute: "/organization/settings#slack",
          },
        ],
      },
    });
  });

  it("should navigate to the correct configuration route when Configure/Setup is clicked", async () => {
    render(
      <MemoryRouter>
        <IntegrationMarketplaceHub />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Jira Issue Tracker")).toBeInTheDocument();
    });

    const configureButtons = screen.getAllByRole("button", {
      name: /^(Configure|Setup Link)$/i,
    });
    expect(configureButtons.length).toBe(2);

    // Jira is connected -> "Configure", Slack is not -> "Setup Link"
    const jiraBtn = screen.getByRole("button", { name: "Configure" });
    fireEvent.click(jiraBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/organization/settings#jira");

    const slackBtn = screen.getByRole("button", { name: "Setup Link" });
    fireEvent.click(slackBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/organization/settings#slack");
  });
});
