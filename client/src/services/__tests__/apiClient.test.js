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

const mockGetCsrfToken = vi.fn();
const mockRefreshCsrfToken = vi.fn();

vi.mock("../csrfService.js", () => ({
  getCsrfToken: (...args) => mockGetCsrfToken(...args),
  refreshCsrfToken: (...args) => mockRefreshCsrfToken(...args),
}));

const DEFAULT_MESSAGE = "An unexpected error occurred. Please try again.";
const OFFLINE_MESSAGE =
  "Network offline. Please check your internet connection.";
const ONLINE_NETWORK_MESSAGE =
  "Unable to reach the server. This may be a network issue or a CORS policy restriction.";

describe("apiClient interceptors", () => {
  let apiClient;
  let rejectInterceptor;

  beforeAll(async () => {
    ({ default: apiClient } = await import("../apiClient.js"));
    rejectInterceptor = apiClient.interceptors.response.handlers[0].rejected;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCsrfToken.mockReturnValue("tok-abc");
    mockRefreshCsrfToken.mockResolvedValue("tok-abc");
  });

  it("attaches credentials and the latest CSRF token on requests", async () => {
    const config = await apiClient.interceptors.request.handlers[0].fulfilled({
      headers: {},
    });

    expect(config.withCredentials).toBe(true);
    expect(config.headers["X-CSRF-Token"]).toBe("tok-abc");
  });

  it("refreshes the CSRF token and retries once on CSRF failure", async () => {
    const retryResponse = { data: { ok: true } };

    mockRefreshCsrfToken.mockResolvedValue("tok-new");
    mockGetCsrfToken.mockReturnValue("tok-new");

    const requestSpy = vi
      .spyOn(apiClient, "request")
      .mockResolvedValue(retryResponse);

    const originalRequest = {
      headers: {},
      url: "/api/test",
      method: "post",
    };

    const result = await rejectInterceptor({
      config: originalRequest,
      response: {
        status: 403,
        data: { message: "CSRF token validation failed." },
      },
    });

    expect(mockRefreshCsrfToken).toHaveBeenCalledTimes(1);
    expect(originalRequest._retry).toBe(true);
    expect(originalRequest.headers["X-CSRF-Token"]).toBe("tok-new");
    expect(requestSpy).toHaveBeenCalled();
    expect(result).toEqual(retryResponse);
  });

  it("does not retry CSRF failures more than once", async () => {
    await expect(
      rejectInterceptor({
        config: { headers: {}, _retry: true },
        response: {
          status: 403,
          data: { message: "CSRF token validation failed." },
        },
      }),
    ).rejects.toMatchObject({
      message: "Session security token expired. Please refresh the page.",
    });

    expect(mockRefreshCsrfToken).not.toHaveBeenCalled();
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
        response: {
          data: { message: "Session expired. Please log in again." },
        },
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
        response: { data: { message: ONLINE_NETWORK_MESSAGE }, status: 0 },
      });
    });

    it("handles missing response.data without throwing", async () => {
      mockCustomError(apiClient, {
        response: { status: 401 },
      });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: "Session expired. Please log in again.",
        response: {
          status: 401,
          data: { message: "Session expired. Please log in again." },
        },
      });
    });

    it("handles null response.data by creating a data payload", async () => {
      mockCustomError(apiClient, {
        response: { status: 404, data: null },
      });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: "The requested resource was not found.",
        response: {
          status: 404,
          data: { message: "The requested resource was not found." },
        },
      });
    });

    it("handles missing response.status with the default fallback message", async () => {
      mockCustomError(apiClient, {
        response: { data: {} },
      });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: DEFAULT_MESSAGE,
        response: { data: { message: DEFAULT_MESSAGE } },
      });
    });

    it("handles an empty error object as a network failure", async () => {
      await expect(rejectInterceptor({})).rejects.toMatchObject({
        message: ONLINE_NETWORK_MESSAGE,
        response: { data: { message: ONLINE_NETWORK_MESSAGE }, status: 0 },
      });
    });

    it("handles an undefined error object without throwing", async () => {
      await expect(rejectInterceptor(undefined)).rejects.toMatchObject({
        message: DEFAULT_MESSAGE,
        response: { data: { message: DEFAULT_MESSAGE }, status: 0 },
      });
    });

    it("handles a null error object without throwing", async () => {
      await expect(rejectInterceptor(null)).rejects.toMatchObject({
        message: DEFAULT_MESSAGE,
        response: { data: { message: DEFAULT_MESSAGE }, status: 0 },
      });
    });

    it("handles unexpected response structures gracefully", async () => {
      mockCustomError(apiClient, {
        response: { status: 422, data: "not-an-object" },
      });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: DEFAULT_MESSAGE,
        response: {
          status: 422,
          data: { message: DEFAULT_MESSAGE },
        },
      });
    });

    it("prefers custom backend messages for unknown HTTP status codes", async () => {
      mockErrorResponse(apiClient, {
        status: 418,
        data: { message: "I'm a teapot from the backend" },
      });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: "I'm a teapot from the backend",
        response: {
          status: 418,
          data: { message: "I'm a teapot from the backend" },
        },
      });
    });

    it("falls back for unknown status codes without a backend message", async () => {
      mockErrorResponse(apiClient, { status: 429, data: {} });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
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

    it("keeps fixed 404 messaging even when a backend message is present", async () => {
      mockErrorResponse(apiClient, {
        status: 404,
        data: { message: "Meeting XYZ was not found in organization" },
      });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: "The requested resource was not found.",
      });
    });

    it("maps 502/503/504 to the server unavailable message", async () => {
      for (const status of [502, 503, 504]) {
        mockErrorResponse(apiClient, { status, data: {} });

        await expect(apiClient.get("/test")).rejects.toMatchObject({
          message: "Server unavailable. Please try again later.",
          response: {
            status,
            data: { message: "Server unavailable. Please try again later." },
          },
        });
      }
    });

    it("maps 419 responses to the CSRF session expired message", async () => {
      mockRefreshCsrfToken.mockRejectedValue(new Error("refresh failed"));
      mockErrorResponse(apiClient, { status: 419, data: {} });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: "Session security token expired. Please refresh the page.",
      });
    });

    it("handles partially populated Axios errors with only a status", async () => {
      mockCustomError(apiClient, {
        isAxiosError: true,
        response: { status: 403 },
      });

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: "You do not have permission to perform this action.",
        response: {
          status: 403,
          data: {
            message: "You do not have permission to perform this action.",
          },
        },
      });
    });

    it("handles CSRF failures that lack an original request config", async () => {
      await expect(
        rejectInterceptor({
          response: {
            status: 403,
            data: { message: "CSRF token validation failed." },
          },
        }),
      ).rejects.toMatchObject({
        message: DEFAULT_MESSAGE,
      });

      expect(mockRefreshCsrfToken).not.toHaveBeenCalled();
    });

    it("uses the session-expired message when CSRF refresh succeeds without a token", async () => {
      mockRefreshCsrfToken.mockResolvedValue(undefined);
      mockGetCsrfToken.mockReturnValue(null);

      await expect(
        rejectInterceptor({
          config: { headers: {} },
          response: {
            status: 403,
            data: { message: "CSRF token validation failed." },
          },
        }),
      ).rejects.toMatchObject({
        message: "Session security token expired. Please refresh the page.",
      });
    });

    it("handles offline network failures through the adapter helper", async () => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      mockNetworkFailure(apiClient, "Failed to fetch");

      await expect(apiClient.get("/test")).rejects.toMatchObject({
        message: OFFLINE_MESSAGE,
        response: { status: 0, data: { message: OFFLINE_MESSAGE } },
      });
    });

    it("rejects consistently and never resolves for malformed errors", async () => {
      const malformedCases = [
        {},
        { response: {} },
        { response: { data: undefined, status: undefined } },
        { response: { status: 400, data: { code: "BAD_REQUEST" } } },
      ];

      for (const malformed of malformedCases) {
        await expect(rejectInterceptor(malformed)).rejects.toMatchObject({
          message: expect.any(String),
          response: expect.objectContaining({
            data: expect.objectContaining({ message: expect.any(String) }),
          }),
        });
      }
    });
  });

  describe("additional HTTP status codes (#420)", () => {
    const SERVER_UNAVAILABLE = "Server unavailable. Please try again later.";
    let originalAdapter;

    beforeEach(() => {
      originalAdapter = captureAdapter(apiClient);
    });

    afterEach(() => {
      restoreAdapter(apiClient, originalAdapter);
    });

    // Codes that fall through to the interceptor default branch:
    // prefer backend message when present, otherwise use DEFAULT_MESSAGE.
    const defaultBranchStatuses = [
      { status: 400, label: "400 Bad Request" },
      { status: 408, label: "408 Request Timeout" },
      { status: 409, label: "409 Conflict" },
      { status: 422, label: "422 Unprocessable Entity" },
      { status: 429, label: "429 Too Many Requests" },
    ];

    it.each(defaultBranchStatuses)(
      "maps $label without a backend message to the default fallback",
      async ({ status }) => {
        mockErrorResponse(apiClient, { status, data: {} });

        await expect(apiClient.get("/test")).rejects.toMatchObject({
          message: DEFAULT_MESSAGE,
          response: {
            status,
            data: { message: DEFAULT_MESSAGE },
          },
        });
      },
    );

    it.each(defaultBranchStatuses)(
      "preserves custom backend messages for $label",
      async ({ status, label }) => {
        const backendMessage = `Backend detail for ${label}`;
        mockErrorResponse(apiClient, {
          status,
          data: { message: backendMessage, code: `E_${status}` },
        });

        await expect(apiClient.get("/test")).rejects.toMatchObject({
          message: backendMessage,
          response: {
            status,
            data: {
              message: backendMessage,
              code: `E_${status}`,
            },
          },
        });
      },
    );

    // 502/503/504 are already covered in #422 for the message mapping.
    // These assertions confirm fixed messaging and response attachment when
    // a backend message is also present (implementation intentionally ignores it).
    it.each([
      { status: 502, label: "502 Bad Gateway" },
      { status: 503, label: "503 Service Unavailable" },
      { status: 504, label: "504 Gateway Timeout" },
    ])(
      "keeps fixed server-unavailable messaging for $label even with a backend message",
      async ({ status }) => {
        mockErrorResponse(apiClient, {
          status,
          data: { message: "Upstream provider timed out" },
        });

        await expect(apiClient.get("/test")).rejects.toMatchObject({
          message: SERVER_UNAVAILABLE,
          response: {
            status,
            data: { message: SERVER_UNAVAILABLE },
          },
        });
      },
    );
  });
});
