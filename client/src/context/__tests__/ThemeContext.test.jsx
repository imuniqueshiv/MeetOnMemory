import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { ThemeProvider } from "../ThemeContext.jsx";
import useTheme from "../useTheme.jsx";

const TestComponent = () => {
  const { theme, resolvedTheme, setThemeMode, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setThemeMode("dark")}>Set Dark</button>
      <button onClick={() => setThemeMode("light")}>Set Light</button>
      <button onClick={() => setThemeMode("system")}>Set System</button>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  );
};

describe("ThemeContext & ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("defaults to system theme and reads local storage if present", () => {
    localStorage.setItem("theme", "dark");
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("updates theme when setThemeMode is called and persists in localStorage", () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByText("Set Dark"));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    fireEvent.click(screen.getByText("Set Light"));
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("removes localStorage item when system theme is selected", () => {
    localStorage.setItem("theme", "dark");
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByText("Set System"));
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("toggles theme correctly via toggleTheme", () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByText("Set Light"));
    fireEvent.click(screen.getByText("Toggle"));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });
});
