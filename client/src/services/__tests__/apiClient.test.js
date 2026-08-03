import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient, { setUnauthorizedHandler } from "../apiClient";

describe("apiClient 401 Token Expiration & Re-authentication Interceptor", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("handles 401 Unauthorized by clearing local storage and dispatching auth:expired event", async () => {
    localStorage.setItem("token", "expired-token");
    localStorage.setItem("userData", JSON.stringify({ name: "User" }));

    const eventListener = vi.fn();
    window.addEventListener("auth:expired", eventListener);

    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    // Mock an internal call returning 401
    const mockError = {
      config: { url: "/api/user/profile" },
      response: {
        status: 401,
        data: { message: "Token expired" },
      },
    };

    // Execute response interceptor error handler directly
    const interceptor = apiClient.interceptors.response.handlers[0].rejected;

    try {
      await interceptor(mockError);
    } catch (err) {
      expect(err.message).toBe("Token expired");
    }

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("userData")).toBeNull();
    expect(eventListener).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not clear credentials or dispatch auth:expired for login credential errors", async () => {
    localStorage.setItem("token", "valid-token");
    const eventListener = vi.fn();
    window.addEventListener("auth:expired", eventListener);

    const mockLoginError = {
      config: { url: "/api/auth/login" },
      response: {
        status: 401,
        data: { message: "Invalid password" },
      },
    };

    const interceptor = apiClient.interceptors.response.handlers[0].rejected;

    try {
      await interceptor(mockLoginError);
    } catch (err) {
      expect(err.message).toBe("Invalid password");
    }

    expect(localStorage.getItem("token")).toBe("valid-token");
    expect(eventListener).not.toHaveBeenCalled();
  });
});
