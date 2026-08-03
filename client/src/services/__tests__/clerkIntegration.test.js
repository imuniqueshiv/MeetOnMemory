import { describe, it, expect, beforeEach, vi } from "vitest";
import apiClient, {
  setClerkTokenGetter,
  getClerkBearerToken,
} from "../apiClient.js";

describe("Clerk Integration - Bearer Auth Interceptor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setClerkTokenGetter(null);
  });

  it("should allow setting a Clerk token getter and attach Authorization header", async () => {
    const mockClerkToken = "clerk_test_token_123";
    const tokenGetter = vi.fn().mockResolvedValue(mockClerkToken);

    setClerkTokenGetter(tokenGetter);

    const dummyConfig = { headers: {} };
    const requestInterceptor =
      apiClient.interceptors.request.handlers[0].fulfilled;

    const updatedConfig = await requestInterceptor(dummyConfig);

    expect(tokenGetter).toHaveBeenCalled();
    expect(updatedConfig.headers.Authorization).toBe(
      `Bearer ${mockClerkToken}`,
    );
    expect(updatedConfig.headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("should handle error gracefully if token getter fails", async () => {
    const tokenGetter = vi
      .fn()
      .mockRejectedValue(new Error("Token fetch error"));
    setClerkTokenGetter(tokenGetter);

    const dummyConfig = { headers: {} };
    const requestInterceptor =
      apiClient.interceptors.request.handlers[0].fulfilled;

    const updatedConfig = await requestInterceptor(dummyConfig);

    expect(tokenGetter).toHaveBeenCalled();
    expect(updatedConfig.headers.Authorization).toBeUndefined();
  });

  it("getClerkBearerToken returns null when unset", async () => {
    await expect(getClerkBearerToken()).resolves.toBeNull();
  });
});
