import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import OfflineQueueInspector from "../OfflineQueueInspector.jsx";
import * as offlineQueue from "../../services/offlineQueue.js";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("OfflineQueueInspector Component (#2249)", () => {
  const mockQueueData = [
    {
      id: "mut-1",
      method: "POST",
      url: "http://localhost:4000/api/tasks",
      status: "queued",
      timestamp: Date.now(),
      body: { title: "New Task" },
    },
    {
      id: "mut-2",
      method: "DELETE",
      url: "http://localhost:4000/api/tags/123",
      status: "failed",
      error: "403 Forbidden",
      timestamp: Date.now(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <OfflineQueueInspector isOpen={false} onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders queued items list with method and URL badges", () => {
    vi.spyOn(offlineQueue, "subscribeQueue").mockImplementation((cb) => {
      cb(mockQueueData);
      return () => {};
    });

    render(<OfflineQueueInspector isOpen={true} onClose={() => {}} />);

    expect(screen.getByText("Offline Mutation Queue")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.getByText("/api/tasks")).toBeInTheDocument();
    expect(screen.getByText("POST")).toBeInTheDocument();
    expect(screen.getByText("/api/tags/123")).toBeInTheDocument();
    expect(screen.getByText("DELETE")).toBeInTheDocument();
    expect(screen.getByText("403 Forbidden")).toBeInTheDocument();
  });

  it("toggles payload preview when View Payload is clicked", () => {
    vi.spyOn(offlineQueue, "subscribeQueue").mockImplementation((cb) => {
      cb(mockQueueData);
      return () => {};
    });

    render(<OfflineQueueInspector isOpen={true} onClose={() => {}} />);

    const viewPayloadBtn = screen.getByRole("button", {
      name: /View Payload/i,
    });
    fireEvent.click(viewPayloadBtn);

    expect(screen.getByText(/New Task/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Hide Payload/i }),
    ).toBeInTheDocument();
  });

  it("retries a single mutation on retry button click", async () => {
    vi.spyOn(offlineQueue, "subscribeQueue").mockImplementation((cb) => {
      cb(mockQueueData);
      return () => {};
    });
    vi.spyOn(offlineQueue, "replayMutation").mockResolvedValue({
      success: true,
      id: "mut-1",
    });

    render(<OfflineQueueInspector isOpen={true} onClose={() => {}} />);

    const retryBtn = screen.getByLabelText("Retry mutation mut-1");
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(offlineQueue.replayMutation).toHaveBeenCalledWith("mut-1");
    });
  });

  it("discards a single mutation on discard button click", async () => {
    vi.spyOn(offlineQueue, "subscribeQueue").mockImplementation((cb) => {
      cb(mockQueueData);
      return () => {};
    });
    vi.spyOn(offlineQueue, "dequeueMutation").mockResolvedValue();

    render(<OfflineQueueInspector isOpen={true} onClose={() => {}} />);

    const discardBtn = screen.getByLabelText("Discard mutation mut-1");
    fireEvent.click(discardBtn);

    await waitFor(() => {
      expect(offlineQueue.dequeueMutation).toHaveBeenCalledWith("mut-1");
    });
  });

  it("triggers sync for all mutations on Sync All Now click", async () => {
    vi.spyOn(offlineQueue, "subscribeQueue").mockImplementation((cb) => {
      cb(mockQueueData);
      return () => {};
    });
    vi.spyOn(offlineQueue, "replayQueuedMutations").mockResolvedValue({
      total: 2,
      succeeded: 2,
      failed: 0,
    });

    render(<OfflineQueueInspector isOpen={true} onClose={() => {}} />);

    const syncAllBtn = screen.getByRole("button", { name: /Sync All Now/i });
    fireEvent.click(syncAllBtn);

    await waitFor(() => {
      expect(offlineQueue.replayQueuedMutations).toHaveBeenCalled();
    });
  });

  it("clears entire queue after confirmation on Clear Queue click", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(offlineQueue, "subscribeQueue").mockImplementation((cb) => {
      cb(mockQueueData);
      return () => {};
    });
    vi.spyOn(offlineQueue, "clearQueue").mockResolvedValue();

    render(<OfflineQueueInspector isOpen={true} onClose={() => {}} />);

    const clearBtn = screen.getByRole("button", { name: /Clear Queue/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(offlineQueue.clearQueue).toHaveBeenCalled();
    });
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    vi.spyOn(offlineQueue, "subscribeQueue").mockImplementation((cb) => {
      cb([]);
      return () => {};
    });

    render(<OfflineQueueInspector isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByLabelText("Close Inspector");
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalled();
  });
});
