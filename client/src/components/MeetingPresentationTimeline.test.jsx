import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MeetingPresentationTimeline from "./MeetingPresentationTimeline";
import apiClient from "../services/apiClient";

// Mock the apiClient
vi.mock("../services/apiClient", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("MeetingPresentationTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render anything if meetingId is missing", () => {
    const { container } = render(<MeetingPresentationTimeline />);
    expect(container.firstChild).toBeNull();
  });

  it("should display loading state initially", () => {
    apiClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<MeetingPresentationTimeline meetingId="123" />);
    expect(
      screen.getByText("Loading presentation timeline..."),
    ).toBeInTheDocument();
  });

  it("should not render if there are no visual chapters", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: { success: true, chapters: [] },
    });

    const { container } = render(
      <MeetingPresentationTimeline meetingId="123" />,
    );

    await waitFor(() => {
      expect(
        screen.queryByText("Loading presentation timeline..."),
      ).not.toBeInTheDocument();
    });

    expect(container.firstChild).toBeNull();
  });

  it("should render visual chapters correctly", async () => {
    const mockChapters = [
      {
        _id: "chap1",
        startTime: 1672531200000,
        title: "Slide 1",
        summary: "Description of slide 1",
        imageUrl: "http://example.com/slide1.jpg",
      },
      {
        _id: "chap2",
        startTime: 1672531210000,
        title: "Slide 2",
        summary: "Description of slide 2",
        // No imageUrl, should be filtered out
      },
    ];

    apiClient.get.mockResolvedValueOnce({
      data: { success: true, chapters: mockChapters },
    });

    render(<MeetingPresentationTimeline meetingId="123" />);

    await waitFor(() => {
      expect(screen.getByText("Presentation Timeline")).toBeInTheDocument();
    });

    // Should only render the chapter with an imageUrl
    expect(screen.getByText("Slide 1")).toBeInTheDocument();
    expect(screen.getByText("Description of slide 1")).toBeInTheDocument();

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", "http://example.com/slide1.jpg");

    expect(screen.queryByText("Slide 2")).not.toBeInTheDocument();
  });

  it("should handle API errors gracefully", async () => {
    apiClient.get.mockRejectedValueOnce(new Error("API Error"));

    const { container } = render(
      <MeetingPresentationTimeline meetingId="123" />,
    );

    await waitFor(() => {
      expect(
        screen.queryByText("Loading presentation timeline..."),
      ).not.toBeInTheDocument();
    });

    // Should not render timeline on error
    expect(container.firstChild).toBeNull();
  });
});
