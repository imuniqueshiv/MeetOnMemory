import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPost = vi.fn();
const mockGet = vi.fn();

vi.mock("../apiClient", () => ({
  default: {
    post: (...args) => mockPost(...args),
    get: (...args) => mockGet(...args),
  },
}));

import { authApi } from "../authApi";

describe("authApi Clerk-era endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ data: { success: true } });
    mockGet.mockResolvedValue({ data: { success: true } });
  });

  it("syncClerkUser posts to /api/auth/sync-clerk-user", async () => {
    await authApi.syncClerkUser();
    expect(mockPost).toHaveBeenCalledWith(
      "/api/auth/sync-clerk-user",
      {},
      undefined,
    );
  });

  it("syncClerkUser forwards optional Clerk profile payload and config", async () => {
    const payload = {
      clerkUserId: "user_123",
      email: "a@b.com",
      name: "Ada",
      profilePic: "https://img",
    };
    const config = { headers: { Authorization: "Bearer tok" } };
    await authApi.syncClerkUser(payload, config);
    expect(mockPost).toHaveBeenCalledWith(
      "/api/auth/sync-clerk-user",
      payload,
      config,
    );
  });

  it("getAuthState hits /api/auth/is-auth", async () => {
    await authApi.getAuthState();
    expect(mockGet).toHaveBeenCalledWith("/api/auth/is-auth", undefined);
  });

  it("getAuthState forwards request config", async () => {
    const config = { headers: { Authorization: "Bearer tok" } };
    await authApi.getAuthState(config);
    expect(mockGet).toHaveBeenCalledWith("/api/auth/is-auth", config);
  });

  it("getUserData hits /api/auth/user-data", async () => {
    await authApi.getUserData();
    expect(mockGet).toHaveBeenCalledWith("/api/auth/user-data", undefined);
  });

  it("logout posts to /api/auth/logout", async () => {
    await authApi.logout();
    expect(mockPost).toHaveBeenCalledWith("/api/auth/logout", {}, undefined);
  });

  it("does not expose legacy identity methods", () => {
    expect(authApi.login).toBeUndefined();
    expect(authApi.register).toBeUndefined();
    expect(authApi.verifyAccount).toBeUndefined();
    expect(authApi.resetPassword).toBeUndefined();
  });
});
