import { describe, it, expect, beforeEach, vi } from "vitest";
import apiClient, { setClerkTokenGetter } from "../apiClient.js";

vi.mock("../csrfService.js", () => ({
  getCsrfToken: vi.fn().mockReturnValue("mock_csrf_token"),
  refreshCsrfToken: vi.fn(),
}));

describe("Clerk Integration - Dual Auth Interceptor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow setting a Clerk token getter and attach Authorization header", async () => {
    const mockClerkToken = "clerk_test_token_123";
    const tokenGetter = vi.fn().mockResolvedValue(mockClerkToken);

    setClerkTokenGetter(tokenGetter);

    // Simulate an interceptor request
    const dummyConfig = { headers: {} };
    const requestInterceptor =
      apiClient.interceptors.request.handlers[0].fulfilled;

    const updatedConfig = await requestInterceptor(dummyConfig);

    expect(tokenGetter).toHaveBeenCalled();
    expect(updatedConfig.headers["Authorization"]).toBe(
      `Bearer ${mockClerkToken}`,
    );
    expect(updatedConfig.headers["X-CSRF-Token"]).toBe("mock_csrf_token");
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
    expect(updatedConfig.headers["Authorization"]).toBeUndefined();
    expect(updatedConfig.headers["X-CSRF-Token"]).toBe("mock_csrf_token");
  });
});
