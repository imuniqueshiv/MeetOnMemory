import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, beforeAll, vi } from "vitest";
import CustomCursor from "./CustomCursor";

// Query-aware matchMedia mock:
// - (pointer: fine)                   → matches: true  (desktop with fine pointer)
// - (prefers-reduced-motion: reduce)  → matches: false (user has NOT requested reduced motion)
// This accurately simulates a standard desktop environment for the happy-path test.
const createMatchMediaMock = (prefersReducedMotion = false) =>
  vi.fn().mockImplementation((query) => ({
    matches:
      query === "(pointer: fine)"
        ? true
        : query === "(prefers-reduced-motion: reduce)"
          ? prefersReducedMotion
          : false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

describe("CustomCursor", () => {
  describe("on a standard desktop (no reduced motion preference)", () => {
    beforeAll(() => {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: createMatchMediaMock(false),
      });
    });

    it("renders cursor elements on desktop devices", () => {
      const { container } = render(<CustomCursor />);

      // Check if the cursor divs are rendered
      expect(container.querySelector(".custom-cursor")).toBeInTheDocument();
      expect(
        container.querySelector(".custom-cursor-ring"),
      ).toBeInTheDocument();
    });
  });

  describe("when the user prefers reduced motion", () => {
    beforeAll(() => {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: createMatchMediaMock(true),
      });
    });

    it("renders nothing to respect the accessibility preference", () => {
      const { container } = render(<CustomCursor />);

      // Component must return null — no cursor elements should exist in the DOM
      expect(container.querySelector(".custom-cursor")).not.toBeInTheDocument();
      expect(
        container.querySelector(".custom-cursor-ring"),
      ).not.toBeInTheDocument();
    });
  });
});
