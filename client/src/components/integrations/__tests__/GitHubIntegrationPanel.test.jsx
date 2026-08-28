import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import GitHubIntegrationPanel from "../GitHubIntegrationPanel";
import * as useGitHubHook from "../../../hooks/useGitHubIntegration";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("GitHubIntegrationPanel (#2237)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders disconnected status and connect trigger when not connected", () => {
    vi.spyOn(useGitHubHook, "useGitHubIntegration").mockReturnValue({
      isConnected: false,
      repositoryFullName: "",
      repositories: [],
      webhookEvents: [],
      loading: false,
      eventsLoading: false,
      error: null,
      connectGitHub: vi.fn(),
      disconnectGitHub: vi.fn(),
      fetchRepos: vi.fn(),
      fetchWebhookEvents: vi.fn(),
      updateConfiguredRepo: vi.fn(),
    });

    render(<GitHubIntegrationPanel organizationId="org_123" />);

    expect(screen.getByTestId("github-sync-status-badge")).toHaveTextContent(
      "Not Connected",
    );
    expect(screen.getByTestId("github-connect-button")).toBeInTheDocument();
  });

  it("renders connected status, repository picker, and webhook events table when connected", async () => {
    const mockUpdateRepo = vi.fn().mockResolvedValue(true);
    const mockFetchEvents = vi.fn();

    vi.spyOn(useGitHubHook, "useGitHubIntegration").mockReturnValue({
      isConnected: true,
      repositoryFullName: "acme/backend-api",
      repositories: [
        { id: 1, fullName: "acme/backend-api", private: false },
        { id: 2, fullName: "acme/frontend-app", private: true },
      ],
      webhookEvents: [
        {
          _id: "evt_1",
          deliveryId: "del_99812",
          event: "issues",
          action: "opened",
          createdAt: "2026-08-20T10:00:00.000Z",
        },
      ],
      loading: false,
      eventsLoading: false,
      error: null,
      connectGitHub: vi.fn(),
      disconnectGitHub: vi.fn(),
      fetchRepos: vi.fn(),
      fetchWebhookEvents: mockFetchEvents,
      updateConfiguredRepo: mockUpdateRepo,
    });

    render(<GitHubIntegrationPanel organizationId="org_123" />);

    expect(screen.getByTestId("github-sync-status-badge")).toHaveTextContent(
      "Connected & Syncing",
    );
    expect(screen.getAllByText("acme/backend-api").length).toBeGreaterThan(0);
    expect(screen.getByText("del_99812")).toBeInTheDocument();
    expect(screen.getByText("opened")).toBeInTheDocument();

    // Select different repository
    const select = screen.getByTestId("github-repo-select");
    fireEvent.change(select, { target: { value: "acme/frontend-app" } });

    const saveBtn = screen.getByTestId("github-save-repo-button");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateRepo).toHaveBeenCalledWith("acme/frontend-app");
    });
  });
});
