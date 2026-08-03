/**
 * Issue #978 — apiClient interceptor behaviour.
 *
 * Drives the real interceptor chain through a mocked axios adapter, so the
 * assertions cover what actually happens to a request rather than what the
 * helper predicates say in isolation.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../config/backendConfig.js", () => ({
  getBackendUrl: () => "http://localhost:4000",
}));

const apiClientModule = await import("../apiClient.js");
const apiClient = apiClientModule.default;
const { DEFAULT_TIMEOUT_MS, requestDeduplicator, setClerkTokenGetter } =
  apiClientModule;

/**
 * Installs a fake adapter driven by a queue of outcomes, and records every
 * request it saw.
 *
 * @param {Array<{status?: number, code?: string, headers?: object, data?: any}>} outcomes
 */
const useAdapter = (outcomes) => {
  const calls = [];
  let index = 0;

  apiClient.defaults.adapter = (config) => {
    calls.push(config);
    const outcome = outcomes[Math.min(index, outcomes.length - 1)];
    index += 1;

    if (outcome.status && outcome.status < 400) {
      return Promise.resolve({
        data: outcome.data ?? {},
        status: outcome.status,
        statusText: "OK",
        headers: outcome.headers ?? {},
        config,
      });
    }

    const error = new Error(outcome.message ?? `Request failed`);
    error.config = config;
    error.code = outcome.code;
    if (outcome.status) {
      error.response = {
        status: outcome.status,
        data: outcome.data ?? {},
        headers: outcome.headers ?? {},
        config,
      };
    }
    return Promise.reject(error);
  };

  return { calls };
};

beforeEach(() => {
  requestDeduplicator.clear();
  setClerkTokenGetter(null);
  vi.useRealTimers();
});

describe("default timeout", () => {
  it("is bounded rather than axios's wait-forever default", () => {
    // axios defaults `timeout` to 0. A request whose connection was silently
    // dropped therefore never settled, so the `finally` that clears every
    // page's loading flag never ran and the spinner span forever.
    expect(apiClient.defaults.timeout).toBe(DEFAULT_TIMEOUT_MS);
    expect(apiClient.defaults.timeout).toBeGreaterThan(0);
  });

  it("can still be overridden per request for long operations", async () => {
    const { calls } = useAdapter([{ status: 200 }]);

    await apiClient.post("/meetings/upload", {}, { timeout: 60000 });

    expect(calls[0].timeout).toBe(60000);
  });
});

describe("retry behaviour", () => {
  it("retries a GET that failed with 503 and returns the eventual success", async () => {
    const { calls } = useAdapter([
      { status: 503 },
      { status: 200, data: { ok: true } },
    ]);

    const response = await apiClient.get("/meetings");

    expect(response.data).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  it("retries a GET that never got a response", async () => {
    const { calls } = useAdapter([
      { code: "ECONNRESET", message: "socket hang up" },
      { status: 200 },
    ]);

    await apiClient.get("/meetings");
    expect(calls).toHaveLength(2);
  });

  it("gives up after the configured number of attempts", async () => {
    const { calls } = useAdapter([{ status: 503 }]);

    await expect(apiClient.get("/meetings", { retries: 1 })).rejects.toThrow();

    expect(calls).toHaveLength(2); // initial + 1 retry
  });

  it("does not retry a POST", async () => {
    const { calls } = useAdapter([{ status: 503 }]);

    await expect(apiClient.post("/meetings", {})).rejects.toThrow();

    // The server may already have created the meeting; a retry would create a
    // second one. A silent duplicate is worse than a visible error.
    expect(calls).toHaveLength(1);
  });

  it("does not retry a 404", async () => {
    const { calls } = useAdapter([{ status: 404 }]);

    await expect(apiClient.get("/nope")).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it("honours RateLimit-Reset on a 429", async () => {
    const { calls } = useAdapter([
      { status: 429, headers: { "ratelimit-reset": "0" } },
      { status: 200 },
    ]);

    await apiClient.get("/meetings");
    expect(calls).toHaveLength(2);
  });
});

describe("error messages", () => {
  it("reports a timeout distinctly from a general connection failure", async () => {
    useAdapter([
      { code: "ECONNABORTED", message: "timeout of 30000ms exceeded" },
    ]);

    const error = await apiClient
      .get("/meetings", { retries: 0 })
      .catch((e) => e);

    // "The server is taking too long" is actionable in a way that "we can't
    // reach it" is not; before this change there was no timeout at all, so the
    // distinction could never be drawn.
    expect(error.message).toMatch(/timed out/i);
  });

  it("preserves the server's own rate-limit message", async () => {
    useAdapter([
      {
        status: 429,
        data: {
          message: "You can only request a data export once every 24 hours.",
        },
      },
    ]);

    const error = await apiClient
      .get("/meetings", { retries: 0 })
      .catch((e) => e);

    // The server's message is more specific than anything the client could
    // hardcode, so 429 must keep falling through to the backend-message branch.
    expect(error.message).toBe(
      "You can only request a data export once every 24 hours.",
    );
  });

  it("still maps 500 to the existing server-unavailable copy", async () => {
    useAdapter([{ status: 500 }]);

    const error = await apiClient
      .get("/meetings", { retries: 0 })
      .catch((e) => e);

    expect(error.message).toBe("Server unavailable. Please try again later.");
  });

  it("prefers the backend's own 403 message", async () => {
    useAdapter([{ status: 403, data: { message: "nope" } }]);

    const error = await apiClient.get("/x").catch((e) => e);
    expect(error.message).toBe("nope");
  });
});

describe("cancellation", () => {
  it("rejects with the raw cancellation, not a friendly network message", async () => {
    useAdapter([{ status: 200 }]);

    const controller = new AbortController();
    const promise = apiClient.get("/meetings", {
      signal: controller.signal,
      dedupe: false,
    });
    controller.abort();

    const error = await promise.catch((e) => e);

    // Rewriting this as "Unable to reach the server" would put an error toast
    // on every keystroke in a search box.
    expect(error.message).not.toMatch(/Unable to reach the server/);
  });
});

describe("request de-duplication", () => {
  it("collapses concurrent identical GETs", async () => {
    const { calls } = useAdapter([{ status: 200, data: { ok: true } }]);

    const [a, b] = await Promise.all([
      apiClient.get("/meetings", { params: { page: 1 } }),
      apiClient.get("/meetings", { params: { page: 1 } }),
    ]);

    expect(calls).toHaveLength(1);
    expect(a.data).toEqual(b.data);
  });

  it("does not collapse GETs with different params", async () => {
    const { calls } = useAdapter([{ status: 200 }]);

    await Promise.all([
      apiClient.get("/meetings", { params: { page: 1 } }),
      apiClient.get("/meetings", { params: { page: 2 } }),
    ]);

    expect(calls).toHaveLength(2);
  });

  it("does not collapse writes", async () => {
    const { calls } = useAdapter([{ status: 200 }]);

    await Promise.all([
      apiClient.post("/meetings", { title: "a" }),
      apiClient.post("/meetings", { title: "a" }),
    ]);

    expect(calls).toHaveLength(2);
  });
});

describe("existing behaviour is preserved", () => {
  it("attaches the Clerk Bearer token when a getter is registered", async () => {
    setClerkTokenGetter(async () => "clerk_test_token");
    const { calls } = useAdapter([{ status: 200 }]);

    await apiClient.get("/meetings");

    expect(calls[0].headers.Authorization).toBe("Bearer clerk_test_token");
    expect(calls[0].headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("still sends credentials", async () => {
    const { calls } = useAdapter([{ status: 200 }]);

    await apiClient.get("/meetings");
    expect(calls[0].withCredentials).toBe(true);
  });

  it("does not retry CSRF-style 403 responses (CSRF retired)", async () => {
    const { calls } = useAdapter([
      { status: 403, data: { message: "CSRF token validation failed." } },
      { status: 200 },
    ]);

    await expect(apiClient.post("/meetings", {})).rejects.toMatchObject({
      message: "CSRF token validation failed.",
    });

    // 403 is not in the retry set and CSRF refresh is gone — one attempt only.
    expect(calls).toHaveLength(1);
  });

  it("still guards against a null rejection payload", async () => {
    apiClient.defaults.adapter = () => Promise.reject(null);

    const error = await apiClient.get("/x").catch((e) => e);
    expect(error.response.status).toBe(0);
  });
});
