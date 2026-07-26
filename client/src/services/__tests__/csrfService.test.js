import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";

vi.mock("axios", () => {
  const mock = {
    get: vi.fn(),
    create: vi.fn(() => ({
      defaults: { headers: { common: {} } },
      interceptors: {
        response: { use: vi.fn() },
      },
    })),
  };
  return { default: mock };
});

vi.mock("../apiClient", () => ({
  default: {
    defaults: {
      headers: {
        common: {},
      },
    },
  },
}));

import apiClient from "../apiClient";
import {
  clearCsrfToken,
  csrfService,
  fetchCsrfToken,
  getCsrfHeaders,
  getCsrfToken,
  withCsrf,
} from "../csrfService";

describe("csrfService", () => {
  beforeEach(() => {
    clearCsrfToken();
    vi.clearAllMocks();
    apiClient.defaults.headers.common = {};
  });

  it("fetches and stores the CSRF token", async () => {
    axios.get.mockResolvedValueOnce({ data: { csrfToken: "tok-1" } });

    const token = await fetchCsrfToken();

    expect(token).toBe("tok-1");
    expect(getCsrfToken()).toBe("tok-1");
    expect(apiClient.defaults.headers.common["X-CSRF-Token"]).toBe("tok-1");
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("/api/csrf-token"),
      { withCredentials: true },
    );
  });

  it("reuses one in-flight fetch for concurrent callers", async () => {
    let resolveRequest;
    axios.get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const first = fetchCsrfToken();
    const second = fetchCsrfToken();

    resolveRequest({ data: { csrfToken: "shared" } });

    await expect(Promise.all([first, second])).resolves.toEqual([
      "shared",
      "shared",
    ]);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it("clears the token and headers", () => {
    apiClient.defaults.headers.common["X-CSRF-Token"] = "old";
    clearCsrfToken();

    expect(getCsrfToken()).toBeNull();
    expect(apiClient.defaults.headers.common["X-CSRF-Token"]).toBeUndefined();
  });

  it("builds request helpers from the current token", async () => {
    axios.get.mockResolvedValueOnce({ data: { csrfToken: "hdr" } });
    await csrfService.fetchToken();

    expect(getCsrfHeaders()).toEqual({ "X-CSRF-Token": "hdr" });
    expect(withCsrf({ headers: { Accept: "application/json" } })).toEqual({
      withCredentials: true,
      headers: {
        Accept: "application/json",
        "X-CSRF-Token": "hdr",
      },
    });
  });

  it("rejects when the response has no token", async () => {
    axios.get.mockResolvedValueOnce({ data: {} });

    await expect(fetchCsrfToken()).rejects.toThrow(
      "CSRF token missing from response",
    );
    expect(getCsrfToken()).toBeNull();
  });

  it("rotates the token on refresh", async () => {
    axios.get
      .mockResolvedValueOnce({ data: { csrfToken: "tok-old" } })
      .mockResolvedValueOnce({ data: { csrfToken: "tok-new" } });

    await csrfService.fetchToken();
    expect(getCsrfToken()).toBe("tok-old");

    const refreshed = await csrfService.refreshToken();
    expect(refreshed).toBe("tok-new");
    expect(getCsrfToken()).toBe("tok-new");
    expect(apiClient.defaults.headers.common["X-CSRF-Token"]).toBe("tok-new");
  });
});
