import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeAll } from "vitest";
import App from "../App";

// Mock matchMedia for JSDOM
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Mock libraries
vi.mock("react-toastify", () => ({
  ToastContainer: () => <div data-testid="toast-container" />,
}));

// Mock components to simplify rendering
vi.mock("../components/ProtectedRoute.jsx", () => ({
  default: ({ children }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));
vi.mock("../components/Footer.jsx", () => ({
  default: () => <div data-testid="footer" />,
}));
vi.mock("../components/ScrollNavigator.jsx", () => ({
  default: () => <div data-testid="scroll-navigator" />,
}));
vi.mock("../components/ErrorBoundary.jsx", () => ({
  default: ({ children }) => <div data-testid="error-boundary">{children}</div>,
}));

// Mock some pages used in the assertions
vi.mock("../pages/Home.jsx", () => ({
  default: () => <div data-testid="home-page" />,
}));
vi.mock("../pages/Login.jsx", () => ({
  default: () => <div data-testid="login-page" />,
}));
vi.mock("../pages/Dashboard.jsx", () => ({
  default: () => <div data-testid="dashboard-page" />,
}));

describe("App Routing", () => {
  it("renders Home on the root path (PublicRoute)", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("home-page")).toBeInTheDocument();

    // Check conditional layouts
    expect(screen.getByTestId("footer")).toBeInTheDocument();
    expect(screen.getByTestId("scroll-navigator")).toBeInTheDocument();
  });

  it("renders Login and hides Footer on /login", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("login-page")).toBeInTheDocument();

    // Check conditional layouts
    expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("scroll-navigator")).not.toBeInTheDocument();
  });

  it("renders Dashboard inside ProtectedRoute (ProtectedRoute)", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
  });

  it("renders Home page as fallback on unknown paths", () => {
    render(
      <MemoryRouter initialEntries={["/unknown-path-that-does-not-exist"]}>
        <App />
      </MemoryRouter>,
    );
    // Since fallback route maps to <Home />
    expect(screen.getByTestId("home-page")).toBeInTheDocument();
  });
});
