import React, { useContext } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppContextProvider } from "../AppContext";
import AppContent from "../AppContent";

const mockGetAuthState = vi.fn();
const mockGetUserData = vi.fn();

vi.mock("../../services", () => ({
  authApi: {
    getAuthState: (...args) => mockGetAuthState(...args),
    getUserData: (...args) => mockGetUserData(...args),
    logout: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const Probe = () => {
  const { loading, isLoggedin, userData, initializeAuth, setLoading } =
    useContext(AppContent);

  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="logged-in">{String(isLoggedin)}</div>
      <div data-testid="user-name">{userData?.name || ""}</div>
      <button
        type="button"
        onClick={async () => {
          await initializeAuth();
          setLoading(false);
        }}
        data-testid="rebootstrap"
      >
        Rebootstrap
      </button>
    </div>
  );
};

describe("AppContext initializeAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const store = {};
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key) => store[key] ?? null),
      setItem: vi.fn((key, value) => {
        store[key] = String(value);
      }),
      removeItem: vi.fn((key) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((key) => delete store[key]);
      }),
    });

    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_mocked_key");
  });

  it("defers mount bootstrap to ClerkSessionSync when Clerk is configured", async () => {
    render(
      <MemoryRouter>
        <AppContextProvider>
          <Probe />
        </AppContextProvider>
      </MemoryRouter>,
    );

    // With VITE_CLERK_PUBLISHABLE_KEY present, AppContext must not race is-auth.
    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("true");
    });
    expect(mockGetAuthState).not.toHaveBeenCalled();
    expect(screen.getByTestId("logged-in")).toHaveTextContent("false");
  });

  it("restores an authenticated session via initializeAuth", async () => {
    mockGetAuthState.mockResolvedValue({ data: { success: true } });
    mockGetUserData.mockResolvedValue({
      data: {
        success: true,
        user: {
          name: "Sanjana",
          organization: { name: "MeetOnMemory" },
          hasCompletedOnboarding: true,
        },
      },
    });

    render(
      <MemoryRouter>
        <AppContextProvider>
          <Probe />
        </AppContextProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId("rebootstrap"));

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(mockGetAuthState).toHaveBeenCalled();
    expect(screen.getByTestId("logged-in")).toHaveTextContent("true");
    expect(screen.getByTestId("user-name")).toHaveTextContent("Sanjana");
  });

  it("clears auth state for anonymous sessions", async () => {
    mockGetAuthState.mockResolvedValue({ data: { success: false } });

    render(
      <MemoryRouter>
        <AppContextProvider>
          <Probe />
        </AppContextProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId("rebootstrap"));

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("logged-in")).toHaveTextContent("false");
    expect(screen.getByTestId("user-name")).toHaveTextContent("");
  });

  it("does not mark the user logged in when user data fails to load", async () => {
    mockGetAuthState.mockResolvedValue({ data: { success: true } });
    mockGetUserData.mockResolvedValue({ data: { success: false } });

    render(
      <MemoryRouter>
        <AppContextProvider>
          <Probe />
        </AppContextProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId("rebootstrap"));

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("logged-in")).toHaveTextContent("false");
    expect(screen.getByTestId("user-name")).toHaveTextContent("");
  });

  it("passes explicit authorization through to is-auth and user-data", async () => {
    mockGetAuthState.mockResolvedValue({ data: { success: true } });
    mockGetUserData.mockResolvedValue({
      data: {
        success: true,
        user: { name: "Ada", hasCompletedOnboarding: false },
      },
    });

    let initializeAuthFn;
    const Capture = () => {
      initializeAuthFn = useContext(AppContent).initializeAuth;
      return null;
    };

    render(
      <MemoryRouter>
        <AppContextProvider>
          <Capture />
        </AppContextProvider>
      </MemoryRouter>,
    );

    await initializeAuthFn({ authorization: "Bearer explicit_jwt" });

    expect(mockGetAuthState).toHaveBeenCalledWith({
      headers: { Authorization: "Bearer explicit_jwt" },
    });
    expect(mockGetUserData).toHaveBeenCalledWith({
      headers: { Authorization: "Bearer explicit_jwt" },
    });
  });
});
