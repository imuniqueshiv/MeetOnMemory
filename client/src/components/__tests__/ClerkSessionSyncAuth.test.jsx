import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClerkSessionSync } from "../ClerkSessionSync";
import AppContent from "../../context/AppContent";
import { authApi } from "../../services";

vi.mock("../../services", () => ({
  authApi: {
    syncClerkUser: vi.fn(),
    logout: vi.fn(),
  },
}));

let mockGetToken = vi.fn();
let mockSignOut = vi.fn();

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    getToken: mockGetToken,
    isSignedIn: true,
    isLoaded: true,
    userId: "user_clerk_123",
  }),
  useUser: () => ({
    user: {
      primaryEmailAddress: { emailAddress: "user@example.com" },
      fullName: "Test User",
      imageUrl: "http://image.url",
    },
  }),
  useClerk: () => ({
    signOut: mockSignOut,
  }),
}));

describe("ClerkSessionSync Auth & Bootstrap Requests", () => {
  let contextValue;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_123");

    contextValue = {
      initializeAuth: vi.fn().mockResolvedValue({ name: "Test User" }),
      isLoggedin: false,
      setIsLoggedin: vi.fn(),
      setUserData: vi.fn(),
      setLoading: vi.fn(),
      userData: null,
      getUserData: vi.fn().mockResolvedValue({ name: "Test User" }),
    };

    mockGetToken.mockResolvedValue("mock_jwt_token");
  });

  it("should retrieve token and call syncClerkUser and initializeAuth during bootstrap", async () => {
    authApi.syncClerkUser.mockResolvedValue({ data: { success: true } });

    render(
      <AppContent.Provider value={contextValue}>
        <ClerkSessionSync />
      </AppContent.Provider>,
    );

    await waitFor(() => {
      expect(mockGetToken).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(authApi.syncClerkUser).toHaveBeenCalledWith(
        {
          clerkUserId: "user_clerk_123",
          email: "user@example.com",
          name: "Test User",
          profilePic: "http://image.url",
        },
        {
          headers: { Authorization: "Bearer mock_jwt_token" },
        },
      );
    });

    await waitFor(() => {
      expect(contextValue.initializeAuth).toHaveBeenCalledWith({
        authorization: "Bearer mock_jwt_token",
      });
    });
  });

  it("should retry bootstrapping if syncClerkUser/initializeAuth fails initially", async () => {
    // Fail first sync, then succeed
    authApi.syncClerkUser
      .mockRejectedValueOnce(new Error("Sync failed"))
      .mockResolvedValue({ data: { success: true } });

    contextValue.initializeAuth
      .mockRejectedValueOnce(new Error("Mongo bootstrap failed"))
      .mockResolvedValue({ name: "Test User" });

    render(
      <AppContent.Provider value={contextValue}>
        <ClerkSessionSync />
      </AppContent.Provider>,
    );

    await waitFor(() => {
      // It should retry after failing initially
      expect(authApi.syncClerkUser).toHaveBeenCalledTimes(2);
    });
  });
});
