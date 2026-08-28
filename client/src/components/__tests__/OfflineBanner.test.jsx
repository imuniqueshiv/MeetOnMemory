import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import OfflineBanner from "../OfflineBanner.jsx";
import * as offlineQueue from "../../services/offlineQueue.js";

vi.mock("../OfflineQueueInspector.jsx", () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="mock-queue-inspector">
        <span>Mock Inspector</span>
        <button onClick={onClose}>Close Inspector</button>
      </div>
    ) : null,
}));

describe("OfflineBanner Component (#2249)", () => {
  let originalOnLine;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
  });

  it("does not render banner when online with no queued items", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    vi.spyOn(offlineQueue, "subscribeQueue").mockImplementation((cb) => {
      cb([]);
      return () => {};
    });

    const { container } = render(<OfflineBanner />);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("renders offline banner when navigator is offline", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    vi.spyOn(offlineQueue, "subscribeQueue").mockImplementation((cb) => {
      cb([]);
      return () => {};
    });

    render(<OfflineBanner />);

    expect(screen.getByText(/You are offline/i)).toBeInTheDocument();
  });

  it("displays queued mutation count when offline with items", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    const mockQueue = [
      { id: 1, method: "POST", url: "/api/tasks", status: "queued" },
      { id: 2, method: "PATCH", url: "/api/tags", status: "queued" },
    ];

    vi.spyOn(offlineQueue, "subscribeQueue").mockImplementation((cb) => {
      cb(mockQueue);
      return () => {};
    });

    render(<OfflineBanner />);

    expect(screen.getByText(/2 changes saved locally/i)).toBeInTheDocument();
    expect(screen.getByText(/Inspect Queue \(2\)/i)).toBeInTheDocument();
  });

  it("opens OfflineQueueInspector when Inspect Queue button is clicked", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    vi.spyOn(offlineQueue, "subscribeQueue").mockImplementation((cb) => {
      cb([{ id: 1, method: "POST", url: "/api/tasks", status: "queued" }]);
      return () => {};
    });

    render(<OfflineBanner />);

    const inspectBtn = screen.getByRole("button", {
      name: /Inspect Queue/i,
    });
    fireEvent.click(inspectBtn);

    expect(screen.getByTestId("mock-queue-inspector")).toBeInTheDocument();
  });

  it("shows reconnecting progress banner during sync", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    vi.spyOn(offlineQueue, "subscribeQueue").mockImplementation((cb) => {
      cb([{ id: 1, method: "POST", url: "/api/tasks", status: "queued" }]);
      return () => {};
    });

    render(<OfflineBanner />);

    act(() => {
      window.dispatchEvent(new CustomEvent("offline-sync-start"));
      window.dispatchEvent(
        new CustomEvent("offline-sync-progress", {
          detail: { current: 1, total: 3 },
        }),
      );
    });

    expect(screen.getByText(/Replaying queued mutations/i)).toBeInTheDocument();
    expect(screen.getByText(/\(1 of 3\)/i)).toBeInTheDocument();
  });

  it("displays sync issue notification when mutations fail", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    const mockFailedQueue = [
      {
        id: 1,
        method: "POST",
        url: "/api/tasks",
        status: "failed",
        error: "Server 500",
      },
    ];

    vi.spyOn(offlineQueue, "subscribeQueue").mockImplementation((cb) => {
      cb(mockFailedQueue);
      return () => {};
    });

    render(<OfflineBanner />);

    expect(
      screen.getByText(/1 offline change failed to sync automatically/i),
    ).toBeInTheDocument();
  });

  it("allows dismissing the banner when online", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    vi.spyOn(offlineQueue, "subscribeQueue").mockImplementation((cb) => {
      cb([{ id: 1, method: "POST", url: "/api/tasks", status: "queued" }]);
      return () => {};
    });

    const { container } = render(<OfflineBanner />);

    const dismissBtn = screen.getByLabelText(/Dismiss banner/i);
    fireEvent.click(dismissBtn);

    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
