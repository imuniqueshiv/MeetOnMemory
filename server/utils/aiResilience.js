// server/utils/aiResilience.js
//
// Issue #976 — Gemini calls have no timeout, no retry, and no prompt budget.
//
// The failure this exists to prevent is not "the AI call fails" — it's that the
// AI call fails *invisibly*. `generateMoMWithAI` caught every Gemini error
// identically and fell straight through to a local model that summarises the
// first 1024 characters and hardcodes `decisions: []` and `action_items: []`.
// The meeting was then persisted as successfully processed. Every downstream
// feature (decision graph, tasks board, conflict detection, policy compliance,
// action-item reminders) saw an empty meeting, and nothing anywhere recorded
// that a degradation had happened.
//
// So this module provides four things, in the order they matter:
//
//   1. classifyAiError — tells a transient 429 apart from a permanent 401, so
//      "retry" and "give up" become different decisions instead of one.
//   2. withTimeout     — bounds every call. `@google/generative-ai` uses fetch
//      with no default timeout, and the AI worker runs at concurrency 1, so one
//      hung call stalls MoM generation for every organization.
//   3. withRetry       — exponential backoff with jitter, honouring the
//      provider's own Retry-After / RetryInfo hint when it sends one.
//   4. circuit breaker — once the provider is confirmed down, stop paying the
//      full timeout budget on every queued job.
//
// Plus prompt budgeting, so a long transcript is chunked and merged rather than
// silently truncated.
//
// Everything is injectable (`sleep`, `now`, `random`) so the retry timing and
// breaker transitions are unit-testable without real delays.

/** Error categories that drive the retry decision. */
export const AI_ERROR_KIND = Object.freeze({
  RATE_LIMIT: "rate_limit",
  SERVER: "server",
  TIMEOUT: "timeout",
  NETWORK: "network",
  AUTH: "auth",
  INVALID_REQUEST: "invalid_request",
  CIRCUIT_OPEN: "circuit_open",
  UNKNOWN: "unknown",
});

/** Node/undici error codes that mean "the connection failed", not "the request was bad". */
const NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ERR_NETWORK",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
]);

/**
 * A normalised provider error. Carries the classification so callers don't each
 * have to re-derive it from a message string.
 */
export class AiProviderError extends Error {
  constructor(message, { kind, status, retryable, retryAfterMs, cause } = {}) {
    super(message);
    this.name = "AiProviderError";
    this.kind = kind ?? AI_ERROR_KIND.UNKNOWN;
    this.status = status ?? null;
    this.retryable = Boolean(retryable);
    this.retryAfterMs = retryAfterMs ?? null;
    if (cause !== undefined) this.cause = cause;
  }
}

/**
 * Pulls an HTTP status out of the many shapes an SDK error can take.
 *
 * `@google/generative-ai` does not expose a stable `status` field — it commonly
 * throws `GoogleGenerativeAIFetchError` whose message begins
 * `[429 Too Many Requests] …`, so the message is a legitimate (and often the
 * only) source. Structured fields are preferred and checked first.
 *
 * @param {any} err
 * @returns {number|null}
 */
export const extractStatus = (err) => {
  if (!err) return null;

  const candidates = [
    err.status,
    err.statusCode,
    err.code,
    err.response?.status,
    err.cause?.status,
  ];
  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isInteger(numeric) && numeric >= 100 && numeric <= 599) {
      return numeric;
    }
  }

  const message = String(err.message ?? err);
  const bracketed = message.match(/\[(\d{3})\b/);
  if (bracketed) return Number(bracketed[1]);

  const bare = message.match(/\b(4\d{2}|5\d{2})\b/);
  if (bare) return Number(bare[1]);

  return null;
};

/**
 * Extracts the provider's own "wait this long" hint, in milliseconds.
 *
 * Two sources, both real: a `Retry-After` response header (seconds or an HTTP
 * date), and Google's `RetryInfo` error detail (`retryDelay: "31s"`). Honouring
 * these beats guessing with backoff — the provider knows when its quota window
 * resets and we don't.
 *
 * @param {any} err
 * @returns {number|null} milliseconds, or null when no hint is present
 */
export const extractRetryAfterMs = (err) => {
  if (!err) return null;

  const header =
    err.response?.headers?.["retry-after"] ??
    err.response?.headers?.get?.("retry-after") ??
    err.headers?.["retry-after"];

  if (header !== undefined && header !== null) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

    const asDate = Date.parse(String(header));
    if (Number.isFinite(asDate)) {
      return Math.max(0, asDate - Date.now());
    }
  }

  // Google RPC RetryInfo, e.g. { retryDelay: "31s" } or "1.5s".
  const details = err.errorDetails ?? err.response?.data?.error?.details;
  if (Array.isArray(details)) {
    for (const detail of details) {
      const delay = detail?.retryDelay;
      if (typeof delay === "string") {
        const match = delay.match(/^([\d.]+)s$/);
        if (match) return Math.round(Number(match[1]) * 1000);
      }
    }
  }

  return null;
};

/**
 * Classifies a provider error into a retry decision.
 *
 * The default for an unrecognised error is **not retryable**. That is
 * deliberate: retrying something we don't understand burns the timeout budget
 * on every attempt and delays the fallback, and an error we can't classify is
 * more likely to be a bug in our own request than a blip on the wire. Only
 * positively-recognised transient conditions are retried.
 *
 * @param {any} err
 * @returns {{kind: string, status: number|null, retryable: boolean, retryAfterMs: number|null}}
 */
export const classifyAiError = (err) => {
  const status = extractStatus(err);
  const retryAfterMs = extractRetryAfterMs(err);
  const code = err?.code;
  const name = err?.name;
  const message = String(err?.message ?? err ?? "").toLowerCase();

  const result = (kind, retryable) => ({
    kind,
    status,
    retryable,
    retryAfterMs,
  });

  // Already classified upstream — trust it.
  if (err instanceof AiProviderError) {
    return {
      kind: err.kind,
      status: err.status,
      retryable: err.retryable,
      retryAfterMs: err.retryAfterMs,
    };
  }

  if (name === "AbortError" || code === "ABORT_ERR") {
    return result(AI_ERROR_KIND.TIMEOUT, true);
  }

  if (typeof code === "string" && NETWORK_ERROR_CODES.has(code)) {
    return result(AI_ERROR_KIND.NETWORK, true);
  }

  if (status === 429) return result(AI_ERROR_KIND.RATE_LIMIT, true);
  if (status === 408) return result(AI_ERROR_KIND.TIMEOUT, true);
  if (status !== null && status >= 500)
    return result(AI_ERROR_KIND.SERVER, true);
  if (status === 401 || status === 403)
    return result(AI_ERROR_KIND.AUTH, false);
  if (status !== null && status >= 400) {
    return result(AI_ERROR_KIND.INVALID_REQUEST, false);
  }

  // Message-based fallbacks for SDKs that surface no status at all. Kept narrow
  // on purpose — a broad "contains error" match would make everything retryable
  // and defeat the point of classifying.
  if (
    message.includes("rate limit") ||
    message.includes("resource_exhausted") ||
    message.includes("quota exceeded") ||
    message.includes("too many requests")
  ) {
    return result(AI_ERROR_KIND.RATE_LIMIT, true);
  }
  if (
    message.includes("overloaded") ||
    message.includes("unavailable") ||
    message.includes("service is currently")
  ) {
    return result(AI_ERROR_KIND.SERVER, true);
  }
  if (message.includes("timed out") || message.includes("timeout")) {
    return result(AI_ERROR_KIND.TIMEOUT, true);
  }
  if (message.includes("socket hang up") || message.includes("network")) {
    return result(AI_ERROR_KIND.NETWORK, true);
  }
  if (message.includes("api key") || message.includes("permission denied")) {
    return result(AI_ERROR_KIND.AUTH, false);
  }

  return result(AI_ERROR_KIND.UNKNOWN, false);
};

/**
 * Runs `fn` with a hard deadline.
 *
 * `fn` receives an `AbortSignal` so a well-behaved client can cancel the
 * underlying request rather than leaving it running after we've stopped caring.
 * The rejection happens either way — the SDK not honouring the signal must not
 * be able to hang the caller, which is the exact failure mode being fixed.
 *
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} fn
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @param {string} [options.label] used in the error message
 * @returns {Promise<T>}
 */
export const withTimeout = async (
  fn,
  { timeoutMs = 60000, label = "AI request" } = {},
) => {
  const controller = new AbortController();
  let timer;

  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new AiProviderError(`${label} timed out after ${timeoutMs}ms`, {
          kind: AI_ERROR_KIND.TIMEOUT,
          retryable: true,
        }),
      );
    }, timeoutMs);
    timer.unref?.();
  });

  try {
    return await Promise.race([
      Promise.resolve().then(() => fn(controller.signal)),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Computes the delay before the next attempt.
 *
 * Full jitter (`random() * exponential`) rather than a fixed multiplier: when a
 * batch of queued jobs all trip the same rate limit, un-jittered backoff makes
 * them retry in lockstep and hit the limit again together.
 *
 * A provider-supplied `retryAfterMs` wins outright — it's authoritative.
 *
 * @param {number} attempt 1-based
 * @param {object} [options]
 * @returns {number} milliseconds
 */
export const computeBackoffDelay = (
  attempt,
  {
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    jitterRatio = 0.5,
    retryAfterMs = null,
    random = Math.random,
  } = {},
) => {
  if (retryAfterMs !== null && retryAfterMs !== undefined) {
    return Math.min(Math.max(0, retryAfterMs), maxDelayMs);
  }

  const exponential = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
  const jitterWindow = exponential * jitterRatio;
  const fixed = exponential - jitterWindow;

  return Math.round(fixed + random() * jitterWindow);
};

const defaultSleep = (ms) =>
  new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });

/**
 * Retries `fn` while the failure is classified retryable.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {object} [options]
 * @param {number} [options.retries] additional attempts after the first
 * @param {Function} [options.classify]
 * @param {Function} [options.onRetry] called with ({attempt, delayMs, error, classification})
 * @param {Function} [options.sleep] injectable for tests
 * @returns {Promise<T>}
 */
export const withRetry = async (
  fn,
  {
    retries = 2,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    jitterRatio = 0.5,
    classify = classifyAiError,
    onRetry = null,
    sleep = defaultSleep,
    random = Math.random,
  } = {},
) => {
  const maxAttempts = Math.max(1, retries + 1);
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const classification = classify(err);

      const isLastAttempt = attempt === maxAttempts;
      if (!classification.retryable || isLastAttempt) {
        throw new AiProviderError(err?.message || String(err), {
          ...classification,
          cause: err,
        });
      }

      const delayMs = computeBackoffDelay(attempt, {
        baseDelayMs,
        maxDelayMs,
        jitterRatio,
        retryAfterMs: classification.retryAfterMs,
        random,
      });

      onRetry?.({ attempt, delayMs, error: err, classification });
      await sleep(delayMs);
    }
  }

  // Unreachable: the loop either returns or throws.
  throw lastError;
};

/** Circuit breaker states. */
export const BREAKER_STATE = Object.freeze({
  CLOSED: "closed",
  OPEN: "open",
  HALF_OPEN: "half_open",
});

/**
 * A minimal circuit breaker.
 *
 * Without one, a provider outage means every queued MoM job independently waits
 * out the full timeout × retry budget before falling back. With `concurrency: 1`
 * on the AI worker, a 60s timeout and 5 attempts, that is minutes of dead time
 * per job while the queue backs up. Once failures are confirmed, failing fast to
 * the fallback is strictly better than confirming the outage over and over.
 *
 * @param {object} [options]
 * @param {number} [options.failureThreshold] consecutive failures before opening
 * @param {number} [options.cooldownMs] how long to stay open before probing
 * @param {Function} [options.now] injectable clock
 */
export const createCircuitBreaker = ({
  failureThreshold = 5,
  cooldownMs = 60000,
  now = () => Date.now(),
  onStateChange = null,
  name = "ai-provider",
} = {}) => {
  let state = BREAKER_STATE.CLOSED;
  let consecutiveFailures = 0;
  let openedAt = 0;

  const transition = (next) => {
    if (state === next) return;
    const previous = state;
    state = next;
    onStateChange?.({ name, from: previous, to: next });
  };

  const recordSuccess = () => {
    consecutiveFailures = 0;
    transition(BREAKER_STATE.CLOSED);
  };

  /**
   * Only failures we believe are the *provider's* fault should open the
   * breaker. A 400 caused by our own malformed prompt is not evidence that
   * Gemini is down, and opening on it would suppress every other caller.
   */
  const recordFailure = (classification) => {
    if (classification && classification.retryable === false) {
      const { kind } = classification;
      if (
        kind === AI_ERROR_KIND.AUTH ||
        kind === AI_ERROR_KIND.INVALID_REQUEST
      ) {
        return;
      }
    }

    consecutiveFailures += 1;
    if (consecutiveFailures >= failureThreshold) {
      openedAt = now();
      transition(BREAKER_STATE.OPEN);
    }
  };

  /** Moves OPEN → HALF_OPEN once the cooldown has elapsed. */
  const refresh = () => {
    if (state === BREAKER_STATE.OPEN && now() - openedAt >= cooldownMs) {
      transition(BREAKER_STATE.HALF_OPEN);
    }
    return state;
  };

  /**
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  const exec = async (fn) => {
    if (refresh() === BREAKER_STATE.OPEN) {
      throw new AiProviderError(
        `Circuit breaker "${name}" is open — failing fast without calling the provider.`,
        { kind: AI_ERROR_KIND.CIRCUIT_OPEN, retryable: false },
      );
    }

    try {
      const result = await fn();
      recordSuccess();
      return result;
    } catch (err) {
      recordFailure(classifyAiError(err));
      throw err;
    }
  };

  return {
    exec,
    recordSuccess,
    recordFailure,
    getState: () => refresh(),
    getFailureCount: () => consecutiveFailures,
    /** Test/ops escape hatch. */
    reset: () => {
      consecutiveFailures = 0;
      openedAt = 0;
      transition(BREAKER_STATE.CLOSED);
    },
  };
};

/**
 * Rough token estimate. ~4 characters per token is the standard approximation
 * for English and is plenty for deciding *whether to chunk* — we only need to
 * stay safely under a limit, not to count exactly.
 *
 * @param {string} text
 * @returns {number}
 */
export const estimateTokens = (text) =>
  Math.ceil(String(text ?? "").length / 4);

/**
 * Splits text into chunks that fit a character budget, preferring natural
 * boundaries.
 *
 * The point is that this replaces `.substring(0, 1024)`. Truncation throws away
 * the end of the meeting — which is where decisions and action items usually
 * are. Chunking keeps all of it.
 *
 * Boundary preference: paragraph break, then sentence end, then a hard cut.
 * `overlapChars` carries a little context across the seam so a decision stated
 * across a boundary isn't lost by either chunk.
 *
 * @param {string} text
 * @param {object} [options]
 * @returns {string[]}
 */
export const chunkTextByBudget = (
  text,
  { maxChars = 24000, overlapChars = 500 } = {},
) => {
  const source = String(text ?? "");
  if (!source.trim()) return [];
  if (source.length <= maxChars) return [source];

  const effectiveOverlap = Math.min(
    Math.max(0, overlapChars),
    Math.floor(maxChars / 2),
  );

  const chunks = [];
  let cursor = 0;

  while (cursor < source.length) {
    const hardEnd = Math.min(cursor + maxChars, source.length);

    let end = hardEnd;
    if (hardEnd < source.length) {
      // Search only the back quarter of the window: further back than that and
      // we'd be discarding usable budget to chase a prettier boundary.
      const searchFloor = cursor + Math.floor(maxChars * 0.75);

      const paragraph = source.lastIndexOf("\n\n", hardEnd);
      const sentence = Math.max(
        source.lastIndexOf(". ", hardEnd),
        source.lastIndexOf("? ", hardEnd),
        source.lastIndexOf("! ", hardEnd),
        source.lastIndexOf("\n", hardEnd),
      );

      if (paragraph > searchFloor) end = paragraph;
      else if (sentence > searchFloor) end = sentence + 1;
    }

    chunks.push(source.slice(cursor, end).trim());

    if (end >= source.length) break;
    cursor = Math.max(end - effectiveOverlap, cursor + 1);
  }

  return chunks.filter(Boolean);
};

/**
 * Composes the whole stack: circuit breaker → retry → timeout.
 *
 * Ordering matters. The breaker is outermost so an open circuit costs nothing;
 * the timeout is innermost so it bounds each individual attempt rather than the
 * whole retry sequence (a 3-attempt call with a 60s timeout should be able to
 * spend 60s per attempt, not 60s total).
 *
 * @template T
 * @param {(signal: AbortSignal) => Promise<T>} fn
 * @param {object} [options]
 * @returns {Promise<T>}
 */
export const callWithResilience = async (
  fn,
  {
    timeoutMs = 60000,
    retries = 2,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    label = "AI request",
    breaker = null,
    onRetry = null,
    sleep = defaultSleep,
    random = Math.random,
  } = {},
) => {
  const attemptOnce = () =>
    withRetry(() => withTimeout(fn, { timeoutMs, label }), {
      retries,
      baseDelayMs,
      maxDelayMs,
      onRetry,
      sleep,
      random,
    });

  return breaker ? breaker.exec(attemptOnce) : attemptOnce();
};

export default {
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
};
