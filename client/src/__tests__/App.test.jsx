import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeAll } from "vitest";
import App from "../App";
import AppContent from "../context/AppContent";

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

vi.mock("@clerk/clerk-react", () => ({
  ClerkProvider: ({ children }) => <>{children}</>,
  SignIn: () => <div data-testid="clerk-sign-in" />,
  SignUp: () => <div data-testid="clerk-sign-up" />,
  UserButton: () => <div data-testid="clerk-user-button" />,
  useAuth: () => ({
    isSignedIn: false,
    isLoaded: true,
    getToken: vi.fn(),
  }),
  useUser: () => ({
    user: null,
    isLoaded: true,
  }),
  useClerk: () => ({
    signOut: vi.fn(),
    openUserProfile: vi.fn(),
  }),
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
vi.mock("../components/FloatingAssistant.jsx", () => ({
  default: () => <div data-testid="floating-assistant" />,
}));
vi.mock("../context/useAssistant", () => ({
  useAssistant: () => ({}),
  AssistantProvider: ({ children }) => <>{children}</>,
}));

// Mock some pages used in the assertions
vi.mock("../pages/Home.jsx", () => ({
  default: () => <div data-testid="home-page" />,
}));
vi.mock("../pages/NotFound.jsx", () => ({
  default: () => <div data-testid="not-found-page" />,
}));
vi.mock("../pages/Login.jsx", () => ({
  default: () => <div data-testid="login-page" />,
}));
vi.mock("../pages/SignUp.jsx", () => ({
  default: () => <div data-testid="signup-page" />,
}));
vi.mock("../pages/Dashboard.jsx", () => ({
  default: () => <div data-testid="dashboard-page" />,
}));

describe("App Routing", () => {
  it("renders Home on the root path (PublicRoute)", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppContent.Provider value={{ isLoggedin: false }}>
          <App />
        </AppContent.Provider>
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
        <AppContent.Provider value={{ isLoggedin: false }}>
          <App />
        </AppContent.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("login-page")).toBeInTheDocument();

    // Check conditional layouts
    expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("scroll-navigator")).not.toBeInTheDocument();
  });

  it("renders SignUp and hides Footer on /signup", () => {
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <AppContent.Provider value={{ isLoggedin: false }}>
          <App />
        </AppContent.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("signup-page")).toBeInTheDocument();
    expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
  });

  it("renders Dashboard inside ProtectedRoute (ProtectedRoute)", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppContent.Provider value={{ isLoggedin: true }}>
          <App />
        </AppContent.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
  });

  it("renders NotFound page as fallback on unknown paths", () => {
    render(
      <MemoryRouter initialEntries={["/unknown-path-that-does-not-exist"]}>
        <AppContent.Provider value={{ isLoggedin: false }}>
          <App />
        </AppContent.Provider>
      </MemoryRouter>,
    );
    // Since fallback route maps to <NotFound />
    expect(screen.getByTestId("not-found-page")).toBeInTheDocument();
  });

  it("does not render the custom glowing cursor overlay (#729)", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <AppContent.Provider value={{ isLoggedin: false }}>
          <App />
        </AppContent.Provider>
      </MemoryRouter>,
    );

    expect(container.querySelector(".custom-cursor")).not.toBeInTheDocument();
    expect(
      container.querySelector(".custom-cursor-ring"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("home-page")).toBeInTheDocument();
  });
});
