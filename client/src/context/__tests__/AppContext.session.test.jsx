import React, { useContext } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppContextProvider } from "../AppContext";
import AppContent from "../AppContent";

const mockGetAuthState = vi.fn();
const mockGetUserData = vi.fn();
const mockLogout = vi.fn();

vi.mock("../../services", () => ({
  authApi: {
    getAuthState: (...args) => mockGetAuthState(...args),
    getUserData: (...args) => mockGetUserData(...args),
    logout: (...args) => mockLogout(...args),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const Probe = () => {
  const {
    loading,
    isLoggedin,
    userData,
    logoutUser,
    initializeAuth,
    setLoading,
  } = useContext(AppContent);

  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="logged-in">{String(isLoggedin)}</div>
      <div data-testid="user-name">{userData?.name || ""}</div>
      <div data-testid="org-name">{userData?.organization?.name || ""}</div>
      <button
        type="button"
        onClick={async () => {
          await initializeAuth();
          setLoading(false);
        }}
        data-testid="bootstrap"
      >
        Bootstrap
      </button>
      <button type="button" onClick={() => logoutUser()} data-testid="logout">
        Logout
      </button>
    </div>
  );
};

describe("AppContext session regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogout.mockResolvedValue({ data: { success: true } });

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

  it("restores auth, user, and organization after ClerkSessionSync bootstrap", async () => {
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

    // Clerk-configured apps defer mount bootstrap to ClerkSessionSync.
    expect(mockGetAuthState).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("bootstrap"));

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(mockGetAuthState).toHaveBeenCalled();
    expect(screen.getByTestId("logged-in")).toHaveTextContent("true");
    expect(screen.getByTestId("user-name")).toHaveTextContent("Sanjana");
    expect(screen.getByTestId("org-name")).toHaveTextContent("MeetOnMemory");
  });

  it("clears auth state on logout", async () => {
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

    fireEvent.click(screen.getByTestId("bootstrap"));

    await waitFor(() => {
      expect(screen.getByTestId("logged-in")).toHaveTextContent("true");
    });

    fireEvent.click(screen.getByTestId("logout"));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId("logged-in")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("user-name")).toHaveTextContent("");
  });
});
