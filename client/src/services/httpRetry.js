// client/src/services/httpRetry.js
//
// Issue #978 — the shared axios client had no timeout, no retry, and no
// cancellation.
//
// This module holds the decision logic (what is retryable, how long to wait,
// which requests can safely be replayed) separately from the interceptor that
// applies it, so the rules are unit-testable without standing up axios mocks
// for every case.
//
// The guiding constraint: **only replay requests that are safe to replay.** A
// dropped `GET /meetings` can be re-issued freely. A dropped `POST /meetings`
// may have already been processed by the server, and re-sending it would create
// a second meeting. Auto-retrying non-idempotent methods trades a visible error
// for a silent duplicate, which is worse.

/** HTTP methods that are idempotent by definition and safe to auto-retry. */
export const IDEMPOTENT_METHODS = new Set(["get", "head", "options"]);

/** Status codes worth a second attempt. */
export const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Axios codes that mean the request never got a response. */
const NETWORK_ERROR_CODES = new Set([
  "ECONNABORTED", // axios timeout
  "ETIMEDOUT",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ERR_NETWORK",
]);

export const DEFAULT_RETRY_CONFIG = Object.freeze({
  retries: 2,
  baseDelayMs: 500,
  maxDelayMs: 8000,
  jitterRatio: 0.5,
});

/**
 * True when the error is axios's own cancellation, i.e. *we* aborted it.
 *
 * These must never be retried and must never surface to the user — an aborted
 * request is the expected outcome of typing another character or navigating
 * away, not a failure.
 *
 * @param {any} error
 */
export const isCancellation = (error) =>
  Boolean(
    error &&
    (error.code === "ERR_CANCELED" ||
      error.name === "CanceledError" ||
      error.__CANCEL__ === true),
  );

/**
 * True when the request failed without ever receiving a response.
 *
 * @param {any} error
 */
export const isNetworkError = (error) => {
  if (!error || error.response) return false;
  if (isCancellation(error)) return false;
  if (error.code && NETWORK_ERROR_CODES.has(error.code)) return true;
  // Axios reports a timeout as ECONNABORTED with a "timeout of Nms exceeded"
  // message; older versions omit the code, so fall back to the message.
  return /timeout|network/i.test(String(error.message ?? ""));
};

/**
 * True when the request exceeded its configured timeout, as opposed to failing
 * for some other network reason. Worth distinguishing because the user-facing
 * message differs.
 *
 * @param {any} error
 */
export const isTimeout = (error) =>
  Boolean(
    error &&
    !error.response &&
    !isCancellation(error) &&
    (error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT" ||
      /timeout/i.test(String(error.message ?? ""))),
  );

/**
 * Decides whether a failed request may be retried.
 *
 * @param {any} error an axios error
 * @param {object} [options]
 * @param {Set<string>} [options.idempotentMethods]
 * @returns {boolean}
 */
export const isRetryable = (
  error,
  { idempotentMethods = IDEMPOTENT_METHODS } = {},
) => {
  if (!error || isCancellation(error)) return false;

  const config = error.config ?? {};

  // An explicit opt-out always wins — a caller that knows its GET has side
  // effects, or simply wants to fail fast, can say so.
  if (config.retry === false) return false;

  const method = String(config.method ?? "get").toLowerCase();

  // A caller can opt a non-idempotent request in when it is genuinely safe
  // (e.g. a PUT that sets an absolute value, or a request carrying an
  // idempotency key).
  const methodAllowed = config.retry === true || idempotentMethods.has(method);
  if (!methodAllowed) return false;

  if (!error.response) return isNetworkError(error);

  return RETRYABLE_STATUSES.has(error.response.status);
};

/**
 * Reads the server's own "wait this long" hint, in milliseconds.
 *
 * The backend sets `standardHeaders: true` on every express-rate-limit
 * instance, so `RateLimit-Reset` is genuinely available on a 429 — and the
 * client previously ignored it entirely, guaranteeing that a retry would arrive
 * too early and be rejected again.
 *
 * @param {any} error
 * @returns {number|null}
 */
export const getRetryAfterMs = (error) => {
  const headers = error?.response?.headers;
  if (!headers) return null;

  const read = (name) =>
    typeof headers.get === "function" ? headers.get(name) : headers[name];

  const retryAfter = read("retry-after");
  if (retryAfter !== undefined && retryAfter !== null && retryAfter !== "") {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

    const asDate = Date.parse(String(retryAfter));
    if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
  }

  // express-rate-limit's standard header: seconds until the window resets.
  const reset = read("ratelimit-reset");
  if (reset !== undefined && reset !== null && reset !== "") {
    const seconds = Number(reset);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  }

  return null;
};

/**
 * Exponential backoff with full jitter.
 *
 * Jitter matters more on the client than it looks: a page that mounts several
 * components hitting the same API will have them all fail together on a blip,
 * and un-jittered backoff makes them all retry at the same instant — which is
 * exactly how a recovering server gets knocked over again.
 *
 * @param {number} attempt 1-based
 * @param {object} [options]
 * @returns {number} milliseconds
 */
export const computeRetryDelay = (
  attempt,
  {
    baseDelayMs = DEFAULT_RETRY_CONFIG.baseDelayMs,
    maxDelayMs = DEFAULT_RETRY_CONFIG.maxDelayMs,
    jitterRatio = DEFAULT_RETRY_CONFIG.jitterRatio,
    retryAfterMs = null,
    random = Math.random,
  } = {},
) => {
  if (retryAfterMs !== null && retryAfterMs !== undefined) {
    return Math.min(Math.max(0, retryAfterMs), maxDelayMs);
  }

  const exponential = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
  const jitterWindow = exponential * jitterRatio;
  return Math.round(exponential - jitterWindow + random() * jitterWindow);
};

/**
 * Builds a stable key identifying a request, for de-duplication.
 *
 * Params are sorted so `?a=1&b=2` and `?b=2&a=1` collapse to one entry.
 *
 * @param {object} config axios request config
 * @returns {string}
 */
export const buildRequestKey = (config = {}) => {
  const method = String(config.method ?? "get").toLowerCase();
  const url = config.url ?? "";
  const baseURL = config.baseURL ?? "";

  let params = "";
  if (config.params && typeof config.params === "object") {
    try {
      params = JSON.stringify(
        Object.keys(config.params)
          .sort()
          .reduce((acc, key) => {
            acc[key] = config.params[key];
            return acc;
          }, {}),
      );
    } catch {
      params = "";
    }
  }

  return `${method} ${baseURL}${url} ${params}`;
};

/**
 * Creates an in-flight request de-duplicator.
 *
 * Several components mounting at once and each requesting the same resource
 * currently produce several identical requests. Coalescing them into one both
 * removes the redundant work and reduces pressure on the global rate limiter
 * (100 requests / 15 min per IP), which a busy page can otherwise trip by
 * itself.
 *
 * Only safe for idempotent reads — two `POST`s that look identical are two
 * distinct intents and must not be collapsed.
 */
export const createRequestDeduplicator = ({
  idempotentMethods = IDEMPOTENT_METHODS,
} = {}) => {
  /** @type {Map<string, Promise<any>>} */
  const inFlight = new Map();

  /**
   * @param {object} config axios request config
   * @param {() => Promise<any>} execute
   * @returns {Promise<any>}
   */
  const run = (config, execute) => {
    const method = String(config?.method ?? "get").toLowerCase();
    const dedupeDisabled = config?.dedupe === false;

    if (dedupeDisabled || !idempotentMethods.has(method)) {
      return execute();
    }

    const key = buildRequestKey(config);
    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = execute().finally(() => {
      // Only clear if we're still the owner: a follow-up request issued after
      // this one settled will have replaced the entry already.
      if (inFlight.get(key) === promise) inFlight.delete(key);
    });

    inFlight.set(key, promise);
    return promise;
  };

  return {
    run,
    size: () => inFlight.size,
    clear: () => inFlight.clear(),
  };
};

export default {
  DEFAULT_RETRY_CONFIG,
  IDEMPOTENT_METHODS,
  RETRYABLE_STATUSES,
  buildRequestKey,
  computeRetryDelay,
  createRequestDeduplicator,
  getRetryAfterMs,
  isCancellation,
  isNetworkError,
  isRetryable,
  isTimeout,
};
