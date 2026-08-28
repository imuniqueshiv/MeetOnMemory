import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CollabSyncStatusChip from "../CollabSyncStatusChip.jsx";

describe("CollabSyncStatusChip (#2250)", () => {
  it("shows Connecting for connecting status", () => {
    render(<CollabSyncStatusChip syncStatus="connecting" />);
    expect(screen.getByTestId("collab-sync-status")).toHaveAttribute(
      "data-status",
      "connecting",
    );
    expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
  });

  it("shows Saving then Synced labels", () => {
    const { rerender } = render(<CollabSyncStatusChip syncStatus="saving" />);
    expect(screen.getByText(/Saving/i)).toBeInTheDocument();

    rerender(<CollabSyncStatusChip syncStatus="synced" />);
    expect(screen.getByText(/^Synced$/i)).toBeInTheDocument();
  });

  it("warns when offline", () => {
    render(<CollabSyncStatusChip syncStatus="offline" />);
    expect(screen.getByTestId("collab-sync-status")).toHaveAttribute(
      "data-status",
      "offline",
    );
    expect(screen.getByText(/Offline/i)).toBeInTheDocument();
  });

  it("shows error syncing state", () => {
    render(<CollabSyncStatusChip syncStatus="error" />);
    expect(screen.getByText(/Error syncing/i)).toBeInTheDocument();
  });
});
