import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ErrorState from "../ErrorState";

describe("ErrorState Component", () => {
  it("renders with default props", () => {
    render(<ErrorState />);
    expect(screen.getByText("An Error Occurred")).toBeInTheDocument();
    expect(
      screen.getByText("Something went wrong. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders with custom title and message", () => {
    render(<ErrorState title="Custom Error" message="Custom error message" />);
    expect(screen.getByText("Custom Error")).toBeInTheDocument();
    expect(screen.getByText("Custom error message")).toBeInTheDocument();
  });

  it("renders retry button and calls onRetry when clicked", () => {
    const handleRetry = vi.fn();
    render(<ErrorState onRetry={handleRetry} retryText="Try Again" />);

    const button = screen.getByRole("button", { name: /Try Again/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });
});
