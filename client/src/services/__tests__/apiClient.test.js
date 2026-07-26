import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCsrfToken = vi.fn();
const mockRefreshCsrfToken = vi.fn();

vi.mock("../csrfService.js", () => ({
  getCsrfToken: (...args) => mockGetCsrfToken(...args),
  refreshCsrfToken: (...args) => mockRefreshCsrfToken(...args),
}));

describe("apiClient interceptors", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetCsrfToken.mockReturnValue("tok-abc");
    mockRefreshCsrfToken.mockResolvedValue("tok-abc");
  });

  it("attaches credentials and the latest CSRF token on requests", async () => {
    const { default: apiClient } = await import("../apiClient.js");

    const config = await apiClient.interceptors.request.handlers[0].fulfilled({
      headers: {},
    });

    expect(config.withCredentials).toBe(true);
    expect(config.headers["X-CSRF-Token"]).toBe("tok-abc");
  });

  it("refreshes the CSRF token and retries once on CSRF failure", async () => {
    const { default: apiClient } = await import("../apiClient.js");
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
    const { default: apiClient } = await import("../apiClient.js");

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
    const { default: apiClient } = await import("../apiClient.js");

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
});
