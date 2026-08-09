import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LiveTranscriptPanel from "../LiveTranscriptPanel.jsx";

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock("../services/apiClient.js", () => ({
  createClerkSocketOptions: vi.fn().mockResolvedValue({}),
}));

describe("LiveTranscriptPanel Dark Mode (#1340)", () => {
  it("renders panel with dark mode CSS classes for complete theme support", () => {
    const { container } = render(
      <LiveTranscriptPanel meetingId="meeting-123" />,
    );

    const rootElement = container.firstChild;
    expect(rootElement).toHaveClass("dark:bg-slate-900");
    expect(rootElement).toHaveClass("dark:border-slate-800");
    expect(
      screen.getByText(/connecting to transcript service/i),
    ).toBeInTheDocument();
  });
});
