import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RecordingSessionAnalyticsPanel from "../RecordingSessionAnalyticsPanel.jsx";
import apiClient from "../../../services/apiClient.js";

vi.mock("../../../services/apiClient.js");

describe("RecordingSessionAnalyticsPanel Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders metrics, stuck session alerts, and sessions table when data loads", async () => {
    const mockMetricsResponse = {
      data: {
        success: true,
        metrics: {
          totalSessions: 5,
          totalDuration: 300,
          totalChunkCount: 60,
          totalRetryCount: 2,
          avgDuration: 60,
          avgChunkCount: 12,
          retryRate: 3.3,
          failureRate: 20,
          statusCounts: { COMPLETED: 3, IN_PROGRESS: 1, FAILED: 1, PAUSED: 0 },
          failureReasons: [{ reason: "Whisper connection timeout", count: 1 }],
          stuckCount: 1,
        },
        stuckSessions: [
          {
            _id: "stuck123",
            status: "IN_PROGRESS",
            chunkCount: 10,
            lastHeartbeatAt: new Date(
              Date.now() - 15 * 60 * 1000,
            ).toISOString(),
            meeting: { title: "Stuck Weekly Sync" },
            user: { name: "Alice" },
          },
        ],
        recentSessions: [
          {
            _id: "stuck123",
            status: "IN_PROGRESS",
            chunkCount: 10,
            retryCount: 0,
            duration: 50,
            lastHeartbeatAt: new Date(
              Date.now() - 15 * 60 * 1000,
            ).toISOString(),
            meeting: { title: "Stuck Weekly Sync" },
            user: { name: "Alice" },
          },
          {
            _id: "comp456",
            status: "COMPLETED",
            chunkCount: 25,
            retryCount: 1,
            duration: 180,
            lastHeartbeatAt: new Date().toISOString(),
            meeting: { title: "Sprint Planning" },
            user: { name: "Bob" },
          },
        ],
      },
    };

    apiClient.get.mockResolvedValue(mockMetricsResponse);

    render(<RecordingSessionAnalyticsPanel />);

    await waitFor(() => {
      expect(
        screen.getByText("Recording Session Analytics"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Stuck Recording Alerts (1)")).toBeInTheDocument();
    expect(screen.getByText("Stuck Weekly Sync")).toBeInTheDocument();

    expect(screen.getByText("5")).toBeInTheDocument(); // totalSessions
    expect(screen.getByText("Sprint Planning")).toBeInTheDocument();
    expect(screen.getByText("Whisper connection timeout")).toBeInTheDocument();
  });

  it("handles resolving a stuck recording session", async () => {
    const mockMetricsResponse = {
      data: {
        success: true,
        metrics: {
          totalSessions: 1,
          totalDuration: 60,
          totalChunkCount: 10,
          totalRetryCount: 0,
          avgDuration: 60,
          avgChunkCount: 10,
          retryRate: 0,
          failureRate: 0,
          statusCounts: { COMPLETED: 0, IN_PROGRESS: 1, FAILED: 0, PAUSED: 0 },
          failureReasons: [],
          stuckCount: 1,
        },
        stuckSessions: [
          {
            _id: "stuck999",
            status: "IN_PROGRESS",
            chunkCount: 5,
            lastHeartbeatAt: new Date(
              Date.now() - 20 * 60 * 1000,
            ).toISOString(),
            meeting: { title: "Hanging Session" },
            user: { name: "Charlie" },
          },
        ],
        recentSessions: [],
      },
    };

    apiClient.get.mockResolvedValue(mockMetricsResponse);
    apiClient.patch.mockResolvedValue({ data: { success: true } });

    render(<RecordingSessionAnalyticsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Hanging Session")).toBeInTheDocument();
    });

    const markFailedBtn = screen.getByText("Mark Failed");
    fireEvent.click(markFailedBtn);

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/api/recording-sessions/stuck999/resolve-stuck",
        expect.objectContaining({ targetStatus: "FAILED" }),
      );
    });
  });
});
