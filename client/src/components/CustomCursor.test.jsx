import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, beforeAll, vi } from "vitest";
import CustomCursor from "./CustomCursor";

// Mock window.matchMedia since it's not supported in JSDOM by default
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: true, // Simulate a desktop environment with a fine pointer
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("CustomCursor", () => {
  it("renders without crashing on desktop devices", () => {
    const { container } = render(<CustomCursor />);

    // Check if the cursor divs are rendered
    expect(container.querySelector(".custom-cursor")).toBeInTheDocument();
    expect(container.querySelector(".custom-cursor-ring")).toBeInTheDocument();
  });
});
