/**
 * Issue #976 — AI generation resilience.
 *
 * `sleep`, `now` and `random` are injected throughout so retry timing and
 * breaker transitions are asserted deterministically and instantly. A test that
 * actually waits out an exponential backoff is a test that gets deleted the
 * first time CI is slow.
 */

import { jest } from "@jest/globals";
import {
  AI_ERROR_KIND,
  AiProviderError,
  BREAKER_STATE,
  callWithResilience,
  chunkTextByBudget,
  classifyAiError,
  computeBackoffDelay,
  createCircuitBreaker,
  estimateTokens,
  extractRetryAfterMs,
  extractStatus,
  withRetry,
  withTimeout,
} from "../utils/aiResilience.js";

/** Collects requested delays instead of waiting them out. */
const makeSleepSpy = () => {
  const delays = [];
  return { delays, sleep: async (ms) => void delays.push(ms) };
};

describe("extractStatus", () => {
  it("prefers a structured status field", () => {
    expect(extractStatus({ status: 503 })).toBe(503);
    expect(extractStatus({ statusCode: 429 })).toBe(429);
    expect(extractStatus({ response: { status: 500 } })).toBe(500);
  });

  it("parses the bracketed status the Gemini SDK puts in its message", () => {
    // GoogleGenerativeAIFetchError has no stable `status` field — the message
    // is genuinely the only place the code appears.
    expect(
      extractStatus(new Error("[429 Too Many Requests] Quota exceeded")),
    ).toBe(429);
    expect(
      extractStatus(new Error("[503 Service Unavailable] overloaded")),
    ).toBe(503);
  });

  it("returns null when no status can be found", () => {
    expect(extractStatus(new Error("something went wrong"))).toBeNull();
    expect(extractStatus(null)).toBeNull();
  });

  it("ignores out-of-range numbers", () => {
    expect(extractStatus({ status: 99 })).toBeNull();
    expect(extractStatus({ status: 9999 })).toBeNull();
  });
});

describe("extractRetryAfterMs", () => {
  it("reads a numeric Retry-After header as seconds", () => {
    expect(
      extractRetryAfterMs({ response: { headers: { "retry-after": "30" } } }),
    ).toBe(30000);
  });

  it("reads Retry-After from a Headers-like object", () => {
    const err = {
      response: { headers: { get: (k) => (k === "retry-after" ? "5" : null) } },
    };
    expect(extractRetryAfterMs(err)).toBe(5000);
  });

  it("reads Google's RetryInfo error detail", () => {
    const err = {
      errorDetails: [
        {
          "@type": "type.googleapis.com/google.rpc.RetryInfo",
          retryDelay: "31s",
        },
      ],
    };
    expect(extractRetryAfterMs(err)).toBe(31000);
  });

  it("handles fractional RetryInfo delays", () => {
    const err = { errorDetails: [{ retryDelay: "1.5s" }] };
    expect(extractRetryAfterMs(err)).toBe(1500);
  });

  it("returns null when the provider gives no hint", () => {
    expect(extractRetryAfterMs(new Error("boom"))).toBeNull();
  });
});

describe("classifyAiError", () => {
  it.each([
    [429, AI_ERROR_KIND.RATE_LIMIT],
    [408, AI_ERROR_KIND.TIMEOUT],
    [500, AI_ERROR_KIND.SERVER],
    [502, AI_ERROR_KIND.SERVER],
    [503, AI_ERROR_KIND.SERVER],
  ])("treats HTTP %i as retryable (%s)", (status, kind) => {
    const result = classifyAiError({ status });
    expect(result.kind).toBe(kind);
    expect(result.retryable).toBe(true);
  });

  it.each([
    [400, AI_ERROR_KIND.INVALID_REQUEST],
    [401, AI_ERROR_KIND.AUTH],
    [403, AI_ERROR_KIND.AUTH],
    [404, AI_ERROR_KIND.INVALID_REQUEST],
  ])("treats HTTP %i as non-retryable (%s)", (status, kind) => {
    const result = classifyAiError({ status });
    expect(result.kind).toBe(kind);
    // Burning the retry budget on a request that will never succeed just
    // delays the fallback.
    expect(result.retryable).toBe(false);
  });

  it.each([
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNREFUSED",
  ])("treats network code %s as retryable", (code) => {
    const result = classifyAiError({ code });
    expect(result.kind).toBe(AI_ERROR_KIND.NETWORK);
    expect(result.retryable).toBe(true);
  });

  it("treats an AbortError as a retryable timeout", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(classifyAiError(err)).toMatchObject({
      kind: AI_ERROR_KIND.TIMEOUT,
      retryable: true,
    });
  });

  it("recognises rate limiting from the message when no status is present", () => {
    expect(
      classifyAiError(new Error("RESOURCE_EXHAUSTED: quota exceeded")),
    ).toMatchObject({ kind: AI_ERROR_KIND.RATE_LIMIT, retryable: true });
    expect(
      classifyAiError(new Error("The model is overloaded. Try again.")),
    ).toMatchObject({ kind: AI_ERROR_KIND.SERVER, retryable: true });
  });

  it("defaults an unrecognised error to non-retryable", () => {
    // Deliberate: an error we can't classify is more likely a bug in our own
    // request than a blip on the wire, and retrying it delays the fallback.
    expect(classifyAiError(new Error("Gemini API Error"))).toMatchObject({
      kind: AI_ERROR_KIND.UNKNOWN,
      retryable: false,
    });
  });

  it("passes an already-classified AiProviderError through unchanged", () => {
    const err = new AiProviderError("nope", {
      kind: AI_ERROR_KIND.RATE_LIMIT,
      status: 429,
      retryable: true,
      retryAfterMs: 1000,
    });
    expect(classifyAiError(err)).toEqual({
      kind: AI_ERROR_KIND.RATE_LIMIT,
      status: 429,
      retryable: true,
      retryAfterMs: 1000,
    });
  });
});

describe("withTimeout", () => {
  it("resolves when the call finishes in time", async () => {
    await expect(
      withTimeout(async () => "ok", { timeoutMs: 200 }),
    ).resolves.toBe("ok");
  });

  it("rejects with a retryable timeout when the call hangs", async () => {
    // The exact failure mode being fixed: the SDK uses fetch with no default
    // timeout, and the AI worker runs at concurrency 1.
    const promise = withTimeout(() => new Promise(() => {}), {
      timeoutMs: 30,
      label: "Gemini MoM",
    });

    await expect(promise).rejects.toMatchObject({
      name: "AiProviderError",
      kind: AI_ERROR_KIND.TIMEOUT,
      retryable: true,
    });
    await expect(promise).rejects.toThrow(/Gemini MoM timed out after 30ms/);
  });

  it("aborts the signal it handed to the caller", async () => {
    let captured;
    await withTimeout(
      (signal) => {
        captured = signal;
        return new Promise(() => {});
      },
      { timeoutMs: 20 },
    ).catch(() => {});

    expect(captured.aborted).toBe(true);
  });

  it("propagates the original rejection when the call fails fast", async () => {
    await expect(
      withTimeout(
        async () => {
          throw new Error("upstream 400");
        },
        { timeoutMs: 500 },
      ),
    ).rejects.toThrow("upstream 400");
  });
});

describe("computeBackoffDelay", () => {
  it("grows exponentially", () => {
    const opts = { baseDelayMs: 1000, jitterRatio: 0, random: () => 0 };
    expect(computeBackoffDelay(1, opts)).toBe(1000);
    expect(computeBackoffDelay(2, opts)).toBe(2000);
    expect(computeBackoffDelay(3, opts)).toBe(4000);
  });

  it("respects maxDelayMs", () => {
    expect(
      computeBackoffDelay(20, {
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        jitterRatio: 0,
        random: () => 0,
      }),
    ).toBe(5000);
  });

  it("applies jitter within the expected window", () => {
    const low = computeBackoffDelay(3, {
      baseDelayMs: 1000,
      jitterRatio: 0.5,
      random: () => 0,
    });
    const high = computeBackoffDelay(3, {
      baseDelayMs: 1000,
      jitterRatio: 0.5,
      random: () => 1,
    });

    // Un-jittered backoff makes a batch of rate-limited jobs retry in lockstep
    // and hit the limit again together.
    expect(low).toBe(2000);
    expect(high).toBe(4000);
  });

  it("lets a provider-supplied Retry-After win outright", () => {
    expect(
      computeBackoffDelay(1, { baseDelayMs: 1000, retryAfterMs: 7000 }),
    ).toBe(7000);
  });

  it("still caps a Retry-After at maxDelayMs", () => {
    expect(
      computeBackoffDelay(1, { retryAfterMs: 999999, maxDelayMs: 10000 }),
    ).toBe(10000);
  });
});

describe("withRetry", () => {
  it("returns immediately on success", async () => {
    const fn = jest.fn(async () => "ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a retryable failure and succeeds", async () => {
    const { sleep, delays } = makeSleepSpy();
    const fn = jest
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce("recovered");

    await expect(
      withRetry(fn, { retries: 2, sleep, random: () => 0 }),
    ).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(delays).toHaveLength(1);
  });

  it("does not retry a non-retryable failure", async () => {
    const { sleep, delays } = makeSleepSpy();
    const fn = jest.fn().mockRejectedValue({ status: 401 });

    await expect(withRetry(fn, { retries: 5, sleep })).rejects.toMatchObject({
      kind: AI_ERROR_KIND.AUTH,
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it("gives up after the configured number of attempts", async () => {
    const { sleep } = makeSleepSpy();
    const fn = jest.fn().mockRejectedValue({ status: 429 });

    await expect(
      withRetry(fn, { retries: 3, sleep, random: () => 0 }),
    ).rejects.toBeInstanceOf(AiProviderError);
    expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  it("backs off exponentially between attempts", async () => {
    const { sleep, delays } = makeSleepSpy();
    const fn = jest.fn().mockRejectedValue({ status: 500 });

    await withRetry(fn, {
      retries: 3,
      baseDelayMs: 100,
      jitterRatio: 0,
      sleep,
      random: () => 0,
    }).catch(() => {});

    expect(delays).toEqual([100, 200, 400]);
  });

  it("honours a provider Retry-After over its own backoff", async () => {
    const { sleep, delays } = makeSleepSpy();
    const fn = jest
      .fn()
      .mockRejectedValueOnce({
        status: 429,
        errorDetails: [{ retryDelay: "12s" }],
      })
      .mockResolvedValueOnce("ok");

    await withRetry(fn, { retries: 2, baseDelayMs: 100, sleep });

    // The provider knows when its quota window resets; we don't.
    expect(delays).toEqual([12000]);
  });

  it("reports each retry through onRetry", async () => {
    const { sleep } = makeSleepSpy();
    const onRetry = jest.fn();
    const fn = jest
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce("ok");

    await withRetry(fn, { retries: 2, onRetry, sleep, random: () => 0 });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0][0]).toMatchObject({
      attempt: 1,
      classification: { kind: AI_ERROR_KIND.SERVER },
    });
  });

  it("wraps the final failure in a classified AiProviderError", async () => {
    const { sleep } = makeSleepSpy();
    const fn = jest
      .fn()
      .mockRejectedValue({ status: 429, message: "slow down" });

    const err = await withRetry(fn, {
      retries: 1,
      sleep,
      random: () => 0,
    }).catch((e) => e);

    expect(err).toBeInstanceOf(AiProviderError);
    expect(err.kind).toBe(AI_ERROR_KIND.RATE_LIMIT);
    expect(err.status).toBe(429);
  });
});

describe("createCircuitBreaker", () => {
  it("stays closed while calls succeed", async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 2 });
    await breaker.exec(async () => "ok");
    expect(breaker.getState()).toBe(BREAKER_STATE.CLOSED);
  });

  it("opens after the failure threshold", async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 2 });

    await breaker
      .exec(async () => Promise.reject({ status: 503 }))
      .catch(() => {});
    expect(breaker.getState()).toBe(BREAKER_STATE.CLOSED);

    await breaker
      .exec(async () => Promise.reject({ status: 503 }))
      .catch(() => {});
    expect(breaker.getState()).toBe(BREAKER_STATE.OPEN);
  });

  it("fails fast without calling the provider while open", async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 1 });
    await breaker
      .exec(async () => Promise.reject({ status: 503 }))
      .catch(() => {});

    const fn = jest.fn(async () => "ok");
    await expect(breaker.exec(fn)).rejects.toMatchObject({
      kind: AI_ERROR_KIND.CIRCUIT_OPEN,
    });

    // The whole point: queued jobs stop paying the full timeout × retry cost
    // to re-confirm an outage we already know about.
    expect(fn).not.toHaveBeenCalled();
  });

  it("half-opens after the cooldown and closes on a successful probe", async () => {
    let clock = 0;
    const breaker = createCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 1000,
      now: () => clock,
    });

    await breaker
      .exec(async () => Promise.reject({ status: 503 }))
      .catch(() => {});
    expect(breaker.getState()).toBe(BREAKER_STATE.OPEN);

    clock = 1000;
    expect(breaker.getState()).toBe(BREAKER_STATE.HALF_OPEN);

    await expect(breaker.exec(async () => "ok")).resolves.toBe("ok");
    expect(breaker.getState()).toBe(BREAKER_STATE.CLOSED);
  });

  it("does not open on errors that are our own fault", async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 2 });

    // A 400 from a malformed prompt is not evidence the provider is down, and
    // opening on it would suppress every other caller.
    await breaker
      .exec(async () => Promise.reject({ status: 400 }))
      .catch(() => {});
    await breaker
      .exec(async () => Promise.reject({ status: 401 }))
      .catch(() => {});

    expect(breaker.getState()).toBe(BREAKER_STATE.CLOSED);
  });

  it("resets the failure count on success", async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 3 });

    await breaker
      .exec(async () => Promise.reject({ status: 503 }))
      .catch(() => {});
    await breaker.exec(async () => "ok");

    expect(breaker.getFailureCount()).toBe(0);
  });

  it("reports state transitions", async () => {
    const onStateChange = jest.fn();
    const breaker = createCircuitBreaker({
      failureThreshold: 1,
      onStateChange,
    });

    await breaker
      .exec(async () => Promise.reject({ status: 503 }))
      .catch(() => {});

    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        from: BREAKER_STATE.CLOSED,
        to: BREAKER_STATE.OPEN,
      }),
    );
  });

  it("can be reset manually", async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 1 });
    await breaker
      .exec(async () => Promise.reject({ status: 503 }))
      .catch(() => {});
    breaker.reset();
    expect(breaker.getState()).toBe(BREAKER_STATE.CLOSED);
  });
});

describe("estimateTokens", () => {
  it("approximates four characters per token", () => {
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });

  it("handles empty and nullish input", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens(null)).toBe(0);
  });
});

describe("chunkTextByBudget", () => {
  it("returns a single chunk when the text fits", () => {
    expect(chunkTextByBudget("short transcript", { maxChars: 100 })).toEqual([
      "short transcript",
    ]);
  });

  it("returns nothing for empty input", () => {
    expect(chunkTextByBudget("", { maxChars: 100 })).toEqual([]);
    expect(chunkTextByBudget("   ", { maxChars: 100 })).toEqual([]);
  });

  it("splits text that exceeds the budget", () => {
    const chunks = chunkTextByBudget("x".repeat(2500), {
      maxChars: 1000,
      overlapChars: 0,
    });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => expect(chunk.length).toBeLessThanOrEqual(1000));
  });

  it("preserves the whole transcript across chunks", () => {
    // This is the regression that matters. `.substring(0, 1024)` threw away the
    // end of the meeting, which is exactly where decisions and action items are.
    const sentences = Array.from(
      { length: 60 },
      (_, i) => `Sentence number ${i} discusses a topic in detail. `,
    ).join("");

    const chunks = chunkTextByBudget(sentences, {
      maxChars: 500,
      overlapChars: 0,
    });

    const rejoined = chunks.join(" ").replace(/\s+/g, " ");
    expect(rejoined).toContain("Sentence number 0 ");
    expect(rejoined).toContain("Sentence number 59 ");
  });

  it("prefers sentence boundaries over hard cuts", () => {
    const text = `${"a".repeat(900)}. ${"b".repeat(900)}. ${"c".repeat(400)}`;
    const [first] = chunkTextByBudget(text, {
      maxChars: 1000,
      overlapChars: 0,
    });
    expect(first.endsWith(".")).toBe(true);
  });

  it("overlaps chunks so a straddling statement is not lost", () => {
    const text = "y".repeat(3000);
    const chunks = chunkTextByBudget(text, {
      maxChars: 1000,
      overlapChars: 200,
    });

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    expect(totalLength).toBeGreaterThan(text.length);
  });

  it("always makes forward progress", () => {
    // Guards against an overlap large enough to make the cursor stand still.
    const chunks = chunkTextByBudget("z".repeat(5000), {
      maxChars: 100,
      overlapChars: 10000,
    });
    expect(chunks.length).toBeLessThan(200);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe("callWithResilience", () => {
  it("composes breaker → retry → timeout", async () => {
    const { sleep } = makeSleepSpy();
    const breaker = createCircuitBreaker({ failureThreshold: 10 });
    const fn = jest
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce("ok");

    await expect(
      callWithResilience(fn, { retries: 2, breaker, sleep, random: () => 0 }),
    ).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("applies the timeout per attempt, not across the whole sequence", async () => {
    const { sleep } = makeSleepSpy();
    let calls = 0;

    // A 3-attempt call with a 60s timeout should be able to spend 60s *per
    // attempt*, not 60s in total.
    const result = await callWithResilience(
      async () => {
        calls += 1;
        if (calls === 1) {
          await new Promise((r) => setTimeout(r, 60));
          return "never";
        }
        return "second attempt";
      },
      { timeoutMs: 25, retries: 2, sleep, random: () => 0 },
    );

    expect(result).toBe("second attempt");
    expect(calls).toBe(2);
  });

  it("works without a breaker", async () => {
    await expect(callWithResilience(async () => "ok")).resolves.toBe("ok");
  });

  it("fails fast when the breaker is open", async () => {
    const breaker = createCircuitBreaker({ failureThreshold: 1 });
    breaker.recordFailure({ retryable: true, kind: AI_ERROR_KIND.SERVER });

    const fn = jest.fn();
    await expect(callWithResilience(fn, { breaker })).rejects.toMatchObject({
      kind: AI_ERROR_KIND.CIRCUIT_OPEN,
    });
    expect(fn).not.toHaveBeenCalled();
  });
});
