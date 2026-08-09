import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ThemeProvider } from "../../context/ThemeContext.jsx";
import ThemeToggle from "../ThemeToggle.jsx";

describe("ThemeToggle Component", () => {
  it("renders light, dark, and system theme buttons", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(
      screen.getByRole("button", { name: /switch to light theme/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /switch to dark theme/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /switch to system color scheme/i }),
    ).toBeInTheDocument();
  });

  it("switches theme mode on button click", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const darkBtn = screen.getByRole("button", {
      name: /switch to dark theme/i,
    });
    fireEvent.click(darkBtn);
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    const lightBtn = screen.getByRole("button", {
      name: /switch to light theme/i,
    });
    fireEvent.click(lightBtn);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
