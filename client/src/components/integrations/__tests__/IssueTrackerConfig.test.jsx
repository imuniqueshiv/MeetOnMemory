import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import IssueTrackerConfig from "../IssueTrackerConfig";
import apiClient from "../../../services/apiClient";

vi.mock("../../../services/apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("IssueTrackerConfig Component (#2238)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders disconnected form initially when config is empty", async () => {
    apiClient.get.mockImplementation((url) => {
      if (url.includes("/config")) {
        return Promise.resolve({ data: { data: null } });
      }
      if (url.includes("/sync-status")) {
        return Promise.resolve({
          data: {
            data: {
              connected: false,
              lastSyncAt: null,
              lastSyncStatus: "idle",
              syncCount: 0,
              syncLogs: [],
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <IssueTrackerConfig
        provider="jira"
        title="Jira Integration"
        description="Sync action items to Jira"
        icon={<span>JiraIcon</span>}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(
          /Enter your Jira Integration access token/i,
        ),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByPlaceholderText(/https:\/\/your-domain.atlassian.net/i),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. PROJ/i)).toBeInTheDocument();
  });

  it("renders connected status and sync history when integration exists", async () => {
    apiClient.get.mockImplementation((url) => {
      if (url.includes("/config")) {
        return Promise.resolve({
          data: {
            data: {
              provider: "jira",
              config: {
                siteUrl: "https://myorg.atlassian.net",
                projectKey: "PROJ",
              },
            },
          },
        });
      }
      if (url.includes("/sync-status")) {
        return Promise.resolve({
          data: {
            data: {
              connected: true,
              lastSyncAt: "2026-08-25T12:00:00Z",
              lastSyncStatus: "success",
              syncCount: 12,
              syncLogs: [
                {
                  timestamp: "2026-08-25T12:00:00Z",
                  action: "outbound_push",
                  status: "success",
                  details: "Created Jira issue PROJ-101",
                },
              ],
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(
      <IssueTrackerConfig
        provider="jira"
        title="Jira Integration"
        description="Sync action items to Jira"
        icon={<span>JiraIcon</span>}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Connected Workspace/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/12 tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/Disconnect/i)).toBeInTheDocument();

    // Expand sync history
    const historyBtn = screen.getByText(/View Recent Sync History/i);
    fireEvent.click(historyBtn);

    expect(
      screen.getByText(/Created Jira issue PROJ-101/i),
    ).toBeInTheDocument();
  });
});
