/**
 * Issue #978 — retry/cancellation decision logic.
 *
 * Kept separate from the interceptor tests: these are pure predicates, so they
 * can be asserted exhaustively without standing up an axios mock per case.
 */

import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_RETRY_CONFIG,
  buildRequestKey,
  computeRetryDelay,
  createRequestDeduplicator,
  getRetryAfterMs,
  isCancellation,
  isNetworkError,
  isRetryable,
  isTimeout,
} from "../httpRetry.js";

/** Shapes an axios-like error. */
const axiosError = ({
  status,
  method = "get",
  code,
  message = "",
  config = {},
  headers,
} = {}) => ({
  code,
  message,
  config: { method, ...config },
  ...(status !== undefined
    ? { response: { status, headers: headers ?? {} } }
    : {}),
});

describe("isCancellation", () => {
  it("recognises every shape axios uses for an abort", () => {
    expect(isCancellation({ code: "ERR_CANCELED" })).toBe(true);
    expect(isCancellation({ name: "CanceledError" })).toBe(true);
    expect(isCancellation({ __CANCEL__: true })).toBe(true);
  });

  it("does not confuse a real failure with a cancellation", () => {
    expect(isCancellation(axiosError({ status: 500 }))).toBe(false);
    expect(isCancellation(null)).toBe(false);
  });
});

describe("isTimeout", () => {
  it("recognises an axios timeout", () => {
    expect(
      isTimeout({
        code: "ECONNABORTED",
        message: "timeout of 30000ms exceeded",
      }),
    ).toBe(true);
  });

  it("does not treat a cancellation as a timeout", () => {
    // Both are "no response", but only one is the user's own doing.
    expect(isTimeout({ code: "ERR_CANCELED", message: "canceled" })).toBe(
      false,
    );
  });

  it("does not treat a server error as a timeout", () => {
    expect(isTimeout(axiosError({ status: 504 }))).toBe(false);
  });
});

describe("isNetworkError", () => {
  it.each(["ECONNRESET", "ENOTFOUND", "ERR_NETWORK", "ETIMEDOUT"])(
    "recognises %s",
    (code) => {
      expect(isNetworkError({ code, message: "" })).toBe(true);
    },
  );

  it("returns false once a response exists", () => {
    expect(isNetworkError(axiosError({ status: 500 }))).toBe(false);
  });

  it("returns false for a cancellation", () => {
    expect(isNetworkError({ code: "ERR_CANCELED" })).toBe(false);
  });
});

describe("isRetryable", () => {
  it.each([408, 425, 429, 500, 502, 503, 504])(
    "retries a GET that failed with %i",
    (status) => {
      expect(isRetryable(axiosError({ status, method: "get" }))).toBe(true);
    },
  );

  it.each([400, 401, 403, 404, 409, 422])(
    "does not retry a GET that failed with %i",
    (status) => {
      // Replaying a request the server has definitively rejected just wastes
      // time and delays the error the user needs to see.
      expect(isRetryable(axiosError({ status, method: "get" }))).toBe(false);
    },
  );

  it.each(["post", "put", "patch", "delete"])(
    "never auto-retries %s",
    (method) => {
      // The request may already have been processed; re-sending it would
      // create a duplicate. A silent double-write is worse than a visible
      // error.
      expect(isRetryable(axiosError({ status: 503, method }))).toBe(false);
    },
  );

  it("retries a non-idempotent method only when the caller opts in", () => {
    expect(
      isRetryable(
        axiosError({ status: 503, method: "post", config: { retry: true } }),
      ),
    ).toBe(true);
  });

  it("honours an explicit opt-out on a GET", () => {
    expect(
      isRetryable(
        axiosError({ status: 503, method: "get", config: { retry: false } }),
      ),
    ).toBe(false);
  });

  it("retries a GET that never got a response", () => {
    expect(
      isRetryable({
        code: "ECONNRESET",
        message: "",
        config: { method: "get" },
      }),
    ).toBe(true);
  });

  it("never retries a cancellation", () => {
    expect(
      isRetryable({ code: "ERR_CANCELED", config: { method: "get" } }),
    ).toBe(false);
  });

  it("treats a missing method as GET", () => {
    expect(isRetryable({ response: { status: 503 }, config: {} })).toBe(true);
  });
});

describe("getRetryAfterMs", () => {
  it("reads a numeric Retry-After as seconds", () => {
    expect(
      getRetryAfterMs(
        axiosError({ status: 429, headers: { "retry-after": "12" } }),
      ),
    ).toBe(12000);
  });

  it("reads express-rate-limit's RateLimit-Reset", () => {
    // The backend sets `standardHeaders: true` on every limiter, so this really
    // is present — and the client used to ignore it entirely, guaranteeing that
    // a retry would arrive too early.
    expect(
      getRetryAfterMs(
        axiosError({ status: 429, headers: { "ratelimit-reset": "45" } }),
      ),
    ).toBe(45000);
  });

  it("reads from a Headers-like object", () => {
    const error = {
      response: {
        status: 429,
        headers: { get: (k) => (k === "retry-after" ? "7" : null) },
      },
    };
    expect(getRetryAfterMs(error)).toBe(7000);
  });

  it("returns null when the server sends no hint", () => {
    expect(getRetryAfterMs(axiosError({ status: 503 }))).toBeNull();
    expect(getRetryAfterMs({ code: "ECONNRESET" })).toBeNull();
  });
});

describe("computeRetryDelay", () => {
  it("grows exponentially", () => {
    const opts = { baseDelayMs: 500, jitterRatio: 0, random: () => 0 };
    expect(computeRetryDelay(1, opts)).toBe(500);
    expect(computeRetryDelay(2, opts)).toBe(1000);
    expect(computeRetryDelay(3, opts)).toBe(2000);
  });

  it("respects the ceiling", () => {
    expect(
      computeRetryDelay(20, {
        baseDelayMs: 500,
        maxDelayMs: 4000,
        jitterRatio: 0,
        random: () => 0,
      }),
    ).toBe(4000);
  });

  it("spreads retries with jitter", () => {
    // A page that mounts several components hitting the same API will have them
    // all fail together on a blip; un-jittered backoff makes them all retry at
    // the same instant, which is how a recovering server gets knocked over.
    const low = computeRetryDelay(2, {
      baseDelayMs: 500,
      jitterRatio: 0.5,
      random: () => 0,
    });
    const high = computeRetryDelay(2, {
      baseDelayMs: 500,
      jitterRatio: 0.5,
      random: () => 1,
    });

    expect(low).toBe(500);
    expect(high).toBe(1000);
  });

  it("prefers the server's own hint", () => {
    expect(computeRetryDelay(1, { retryAfterMs: 3000 })).toBe(3000);
  });

  it("still caps the server's hint", () => {
    expect(
      computeRetryDelay(1, { retryAfterMs: 999999, maxDelayMs: 5000 }),
    ).toBe(5000);
  });

  it("exposes sane defaults", () => {
    expect(DEFAULT_RETRY_CONFIG.retries).toBeGreaterThan(0);
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBeGreaterThan(
      DEFAULT_RETRY_CONFIG.baseDelayMs,
    );
  });
});

describe("buildRequestKey", () => {
  it("is stable regardless of param order", () => {
    const a = buildRequestKey({
      method: "get",
      url: "/m",
      params: { a: 1, b: 2 },
    });
    const b = buildRequestKey({
      method: "get",
      url: "/m",
      params: { b: 2, a: 1 },
    });
    expect(a).toBe(b);
  });

  it("distinguishes different params, urls and methods", () => {
    const base = { method: "get", url: "/m", params: { page: 1 } };
    expect(buildRequestKey(base)).not.toBe(
      buildRequestKey({ ...base, params: { page: 2 } }),
    );
    expect(buildRequestKey(base)).not.toBe(
      buildRequestKey({ ...base, url: "/other" }),
    );
    expect(buildRequestKey(base)).not.toBe(
      buildRequestKey({ ...base, method: "post" }),
    );
  });
});

describe("createRequestDeduplicator", () => {
  it("collapses concurrent identical GETs into one request", async () => {
    const dedupe = createRequestDeduplicator();
    const execute = vi.fn(
      () => new Promise((resolve) => setTimeout(() => resolve("ok"), 20)),
    );
    const config = { method: "get", url: "/meetings" };

    const [a, b, c] = await Promise.all([
      dedupe.run(config, execute),
      dedupe.run(config, execute),
      dedupe.run(config, execute),
    ]);

    // Several components mounting at once and each requesting the same
    // resource previously produced several identical requests, which also
    // pushed the page toward the global rate limiter by itself.
    expect(execute).toHaveBeenCalledTimes(1);
    expect([a, b, c]).toEqual(["ok", "ok", "ok"]);
  });

  it("does not collapse different requests", async () => {
    const dedupe = createRequestDeduplicator();
    const execute = vi.fn(async () => "ok");

    await Promise.all([
      dedupe.run({ method: "get", url: "/a" }, execute),
      dedupe.run({ method: "get", url: "/b" }, execute),
    ]);

    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("never collapses writes", async () => {
    const dedupe = createRequestDeduplicator();
    const execute = vi.fn(async () => "ok");
    const config = { method: "post", url: "/meetings" };

    // Two identical-looking POSTs are two distinct intents.
    await Promise.all([
      dedupe.run(config, execute),
      dedupe.run(config, execute),
    ]);

    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("issues a fresh request once the first has settled", async () => {
    const dedupe = createRequestDeduplicator();
    const execute = vi.fn(async () => "ok");
    const config = { method: "get", url: "/meetings" };

    await dedupe.run(config, execute);
    await dedupe.run(config, execute);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(dedupe.size()).toBe(0);
  });

  it("clears the entry when the shared request rejects", async () => {
    const dedupe = createRequestDeduplicator();
    const execute = vi.fn(async () => {
      throw new Error("boom");
    });
    const config = { method: "get", url: "/meetings" };

    await Promise.all([
      dedupe.run(config, execute).catch(() => {}),
      dedupe.run(config, execute).catch(() => {}),
    ]);

    expect(execute).toHaveBeenCalledTimes(1);
    // A failed request must not poison the key for all future callers.
    expect(dedupe.size()).toBe(0);
  });

  it("honours an explicit opt-out", async () => {
    const dedupe = createRequestDeduplicator();
    const execute = vi.fn(
      () => new Promise((resolve) => setTimeout(() => resolve("ok"), 10)),
    );
    const config = { method: "get", url: "/meetings", dedupe: false };

    await Promise.all([
      dedupe.run(config, execute),
      dedupe.run(config, execute),
    ]);

    expect(execute).toHaveBeenCalledTimes(2);
  });
});
