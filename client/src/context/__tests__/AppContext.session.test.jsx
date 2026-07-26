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
const mockLogout = vi.fn();

vi.mock("../../services", () => ({
  csrfService: {
    fetchToken: (...args) => mockFetchToken(...args),
    clearToken: (...args) => mockClearToken(...args),
  },
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
  const { loading, isLoggedin, userData, logoutUser } = useContext(AppContent);

  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="logged-in">{String(isLoggedin)}</div>
      <div data-testid="user-name">{userData?.name || ""}</div>
      <div data-testid="org-name">{userData?.organization?.name || ""}</div>
      <button type="button" onClick={() => logoutUser()} data-testid="logout">
        Logout
      </button>
    </div>
  );
};

describe("AppContext session regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchToken.mockResolvedValue("csrf-token");
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
  });

  it("restores auth, user, and organization after a page refresh", async () => {
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
    expect(screen.getByTestId("org-name")).toHaveTextContent("MeetOnMemory");
  });

  it("clears auth state and CSRF token on logout", async () => {
    mockGetAuthState
      .mockResolvedValueOnce({ data: { success: true } })
      .mockResolvedValue({ data: { success: false } });
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
      expect(screen.getByTestId("logged-in")).toHaveTextContent("true");
    });

    screen.getByTestId("logout").click();

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(mockClearToken).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId("logged-in")).toHaveTextContent("false");
    });

    expect(screen.getByTestId("user-name")).toHaveTextContent("");
  });
});
