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

describe("apiClient interceptors", () => {
  let apiClient;

  beforeAll(async () => {
    ({ default: apiClient } = await import("../apiClient.js"));
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

    const result = await apiClient.interceptors.response.handlers[0].rejected({
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
      apiClient.interceptors.response.handlers[0].rejected({
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
      apiClient.interceptors.response.handlers[0].rejected({
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
        message: "Network offline. Please check your internet connection.",
        response: {
          data: {
            message: "Network offline. Please check your internet connection.",
          },
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
        message:
          "Unable to reach the server. This may be a network issue or a CORS policy restriction.",
      });
    });
  });
});
