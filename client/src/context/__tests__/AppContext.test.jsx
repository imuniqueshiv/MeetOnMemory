import React, { useContext } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppContextProvider } from "../AppContext";
import AppContent from "../AppContent";

const mockFetchToken = vi.fn();
const mockClearToken = vi.fn();
const mockGetAuthState = vi.fn();
const mockGetUserData = vi.fn();

vi.mock("../../services", () => ({
  csrfService: {
    fetchToken: (...args) => mockFetchToken(...args),
    clearToken: (...args) => mockClearToken(...args),
  },
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
  const { loading, isLoggedin, userData, initializeAuth } =
    useContext(AppContent);

  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="logged-in">{String(isLoggedin)}</div>
      <div data-testid="user-name">{userData?.name || ""}</div>
      <button
        type="button"
        onClick={() => initializeAuth()}
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
    mockFetchToken.mockResolvedValue("csrf-token");

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
  });

  it("restores an authenticated session on mount", async () => {
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

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(mockFetchToken).toHaveBeenCalled();
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

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("logged-in")).toHaveTextContent("false");
    expect(screen.getByTestId("user-name")).toHaveTextContent("");
  });
});
