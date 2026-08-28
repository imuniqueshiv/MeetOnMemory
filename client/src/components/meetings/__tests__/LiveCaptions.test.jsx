import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LiveCaptions from "../LiveCaptions.jsx";

describe("LiveCaptions Component (#2246)", () => {
  const sampleCaptions = [
    { text: "Hello team", speaker: "Alice", isFinal: true },
    { text: "We are discussing sprint goals", speaker: "Bob", isFinal: false },
  ];

  it("does not render when showCaptions is false", () => {
    const { container } = render(
      <LiveCaptions showCaptions={false} captions={sampleCaptions} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render when captions array is empty", () => {
    const { container } = render(
      <LiveCaptions showCaptions={true} captions={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders captions with speaker labels and proper styles for final vs interim", () => {
    render(<LiveCaptions showCaptions={true} captions={sampleCaptions} />);

    expect(screen.getByTestId("live-captions-container")).toBeInTheDocument();
    expect(screen.getByText("Live Captions")).toBeInTheDocument();
    expect(screen.getByText("Alice:")).toBeInTheDocument();
    expect(screen.getByText("Hello team")).toBeInTheDocument();
    expect(screen.getByText("Bob:")).toBeInTheDocument();
    expect(
      screen.getByText("We are discussing sprint goals"),
    ).toBeInTheDocument();
  });

  it("renders saving status indicator when saveStatus is 'saving'", () => {
    render(
      <LiveCaptions
        showCaptions={true}
        captions={sampleCaptions}
        saveStatus="saving"
      />,
    );

    expect(screen.getByTestId("caption-save-saving")).toBeInTheDocument();
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("renders saved status indicator when saveStatus is 'saved'", () => {
    render(
      <LiveCaptions
        showCaptions={true}
        captions={sampleCaptions}
        saveStatus="saved"
      />,
    );

    expect(screen.getByTestId("caption-save-saved")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("renders error status and calls onRetry when retry button is clicked", () => {
    const handleRetry = vi.fn();
    render(
      <LiveCaptions
        showCaptions={true}
        captions={sampleCaptions}
        saveStatus="error"
        errorMessage="Network timeout"
        onRetry={handleRetry}
      />,
    );

    expect(screen.getByTestId("caption-save-error")).toBeInTheDocument();
    expect(screen.getByText("Network timeout")).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", {
      name: /retry saving captions/i,
    });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});
