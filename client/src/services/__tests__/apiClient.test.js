import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  captureAdapter,
  mockCustomError,
  mockErrorResponse,
  mockNetworkFailure,
  mockSuccessfulResponse,
  restoreAdapter,
} from "./helpers/axiosAdapterMocks.js";

const DEFAULT_MESSAGE = "An unexpected error occurred. Please try again.";
const OFFLINE_MESSAGE =
  "Network offline. Please check your internet connection.";
const ONLINE_NETWORK_MESSAGE =
  "Unable to reach the server. This may be a network issue or a CORS policy restriction.";

describe("apiClient interceptors", () => {
  let apiClient;
  let setClerkTokenGetter;
  let setUnauthorizedHandler;
  let rejectInterceptor;

  beforeAll(async () => {
    ({
      default: apiClient,
      setClerkTokenGetter,
      setUnauthorizedHandler,
    } = await import("../apiClient.js"));
    rejectInterceptor = apiClient.interceptors.response.handlers[0].rejected;
  });

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    setClerkTokenGetter(null);
  });

  it("handles 401 Unauthorized by clearing local storage and dispatching auth:expired event", async () => {
    localStorage.setItem("token", "expired-token");
    localStorage.setItem("userData", JSON.stringify({ name: "User" }));

    const eventListener = vi.fn();
    window.addEventListener("auth:expired", eventListener);

    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    const mockError = {
      config: { url: "/api/user/profile" },
      response: {
        status: 401,
        data: { message: "Token expired" },
      },
    };

    try {
      await rejectInterceptor(mockError);
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

    try {
      await rejectInterceptor(mockLoginError);
    } catch (err) {
      expect(err.message).toBe("Invalid password");
    }

    expect(localStorage.getItem("token")).toBe("valid-token");
    expect(eventListener).not.toHaveBeenCalled();
  });

  it("attaches credentials and Clerk Bearer token on requests", async () => {
    setClerkTokenGetter(async () => "clerk_test_token");

    const config = await apiClient.interceptors.request.handlers[0].fulfilled({
      headers: {},
    });

    expect(config.withCredentials).toBe(true);
    expect(config.headers.Authorization).toBe("Bearer clerk_test_token");
  });

  it("preserves an Authorization header already set by the caller", async () => {
    setClerkTokenGetter(async () => "getter_token");

    const config = await apiClient.interceptors.request.handlers[0].fulfilled({
      headers: { Authorization: "Bearer explicit_token" },
    });

    expect(config.headers.Authorization).toBe("Bearer explicit_token");
  });

  it("continues without Authorization when Clerk token getter is unset", async () => {
    const config = await apiClient.interceptors.request.handlers[0].fulfilled({
      headers: {},
    });

    expect(config.withCredentials).toBe(true);
    expect(config.headers.Authorization).toBeUndefined();
  });

  describe("response interceptor via adapter", () => {
    let originalAdapter;
    let originalOnLine;

    beforeEach(() => {
      originalAdapter = captureAdapter(apiClient);
      originalOnLine = navigator.onLine;
    });

    afterEach(() => {
      restoreAdapter(apiClient, originalAdapter);
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: originalOnLine,
      });
    });

    it("returns successful responses unchanged", async () => {
      mockSuccessfulResponse(apiClient, { ok: true });

      await expect(apiClient.get("/test")).resolves.toMatchObject({
        data: { ok: true },
        status: 200,
      });
    });

    it("handles 401 Unauthorized", async () => {
      mockErrorResponse(apiClient, { status: 401, data: {} });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: "Session expired. Please log in again.",
      });
    });

    it("handles 403 Forbidden", async () => {
      mockErrorResponse(apiClient, { status: 403, data: {} });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: "You do not have permission to perform this action.",
      });
    });

    it("handles 404 Not Found", async () => {
      mockErrorResponse(apiClient, { status: 404, data: {} });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: "The requested resource was not found.",
      });
    });

    it("handles server errors (500)", async () => {
      mockErrorResponse(apiClient, { status: 500, data: {} });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: "Server unavailable. Please try again later.",
      });
    });

    it("handles network errors when offline", async () => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      mockNetworkFailure(apiClient);

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: OFFLINE_MESSAGE,
      });
    });
  });
});
