import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ErrorBoundary from "../ErrorBoundary";

// A component that always throws an error
const ProblemChild = () => {
  throw new Error("Test Error from ProblemChild");
};

describe("ErrorBoundary", () => {
  it("renders children if no error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Safe Content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Safe Content")).toBeInTheDocument();
  });

  it("renders ErrorState fallback when a child throws", () => {
    // Suppress console.error for the expected error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>,
    );

    // Check for fallback UI instead of crashing
    expect(screen.getByText("Oops! Something went wrong.")).toBeInTheDocument();
    expect(
      screen.getByText("Test Error from ProblemChild"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Try Again/i }),
    ).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
