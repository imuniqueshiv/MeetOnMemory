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
  let rejectInterceptor;

  beforeAll(async () => {
    ({ default: apiClient, setClerkTokenGetter } =
      await import("../apiClient.js"));
    rejectInterceptor = apiClient.interceptors.response.handlers[0].rejected;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setClerkTokenGetter(null);
  });

  it("attaches credentials and Clerk Bearer token on requests", async () => {
    setClerkTokenGetter(async () => "clerk_test_token");

    const config = await apiClient.interceptors.request.handlers[0].fulfilled({
      headers: {},
    });

    expect(config.withCredentials).toBe(true);
    expect(config.headers.Authorization).toBe("Bearer clerk_test_token");
    expect(config.headers["X-CSRF-Token"]).toBeUndefined();
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

  it("maps 401 responses to a friendly session message", async () => {
    await expect(
      rejectInterceptor({
        config: { headers: {} },
        response: {
          status: 401,
          data: {},
        },
      }),
    ).rejects.toMatchObject({
      message: "Session expired. Please log in again.",
    });
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

    it("adds a short request reference to unexpected server errors", async () => {
      mockErrorResponse(apiClient, {
        status: 500,
        data: {
          message: "Internal Server Error",
          requestId: "7e4de5f1-1234-4567-8901-abcdefabcdef",
        },
      });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message:
          "Server unavailable. Please try again later. Reference: 7e4de5f1-123",
        response: {
          data: {
            requestId: "7e4de5f1-1234-4567-8901-abcdefabcdef",
          },
        },
      });
    });

    it("does not append a request reference to expected authorization errors", async () => {
      mockErrorResponse(apiClient, {
        status: 403,
        data: {
          message: "You do not have permission to perform this action.",
          requestId: "authorization-request-id",
        },
      });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: "You do not have permission to perform this action.",
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
        response: {
          data: { message: OFFLINE_MESSAGE },
          status: 0,
        },
      });
    });

    it("handles network errors when online", async () => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });
      mockNetworkFailure(apiClient);

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: ONLINE_NETWORK_MESSAGE,
      });
    });
  });

  describe("edge-case error handling (#422)", () => {
    let originalAdapter;
    let originalOnLine;

    beforeEach(() => {
      originalAdapter = captureAdapter(apiClient);
      originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });
    });

    afterEach(() => {
      restoreAdapter(apiClient, originalAdapter);
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: originalOnLine,
      });
    });

    it("handles missing response as an online network failure", async () => {
      mockCustomError(apiClient, { message: "Network Error" });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: ONLINE_NETWORK_MESSAGE,
      });
    });

    it("handles null response.data by creating a data payload", async () => {
      mockCustomError(apiClient, {
        response: { status: 404, data: null },
      });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: "The requested resource was not found.",
      });
    });

    it("handles an undefined error object without throwing", async () => {
      await expect(rejectInterceptor(undefined)).rejects.toMatchObject({
        message: DEFAULT_MESSAGE,
      });
    });

    it("handles a null error object without throwing", async () => {
      await expect(rejectInterceptor(null)).rejects.toMatchObject({
        message: DEFAULT_MESSAGE,
      });
    });

    it("prefers custom backend messages on 401 responses", async () => {
      mockErrorResponse(apiClient, {
        status: 401,
        data: { message: "Account locked. Contact an administrator." },
      });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: "Account locked. Contact an administrator.",
      });
    });

    it("maps 502/503/504 to the server unavailable message", async () => {
      for (const status of [502, 503, 504]) {
        mockErrorResponse(apiClient, { status, data: {} });

        await expect(apiClient.get("/test")).rejects.toMatchObject({
          message: "Server unavailable. Please try again later.",
        });
      }
    });
  });
});
