import axios from "axios";
import { getBackendUrl } from "../config/backendConfig.js";
import {
  DEFAULT_RETRY_CONFIG,
  computeRetryDelay,
  createRequestDeduplicator,
  getRetryAfterMs,
  isCancellation,
  isRetryable,
  isTimeout,
} from "./httpRetry.js";

const backendUrl = getBackendUrl();

/**
 * Default per-request deadline (Issue #978).
 *
 * axios defaults `timeout` to `0`, i.e. wait forever. A request whose connection
 * is silently dropped — laptop sleep, Wi-Fi→cellular handover, a load balancer
 * that black-holes rather than resets — therefore *never settled*. Neither
 * `.then` nor `.catch` ran, so the `finally` block that every page uses to clear
 * its loading flag never ran either, and the spinner span forever with no error
 * and no way to recover but a manual reload.
 *
 * 30s is comfortably above a slow-but-working request and well below the point
 * where a user has already given up. Long operations (uploads, exports)
 * override it per request.
 */
export const DEFAULT_TIMEOUT_MS = 30000;

const apiClient = axios.create({
  baseURL: backendUrl,
  withCredentials: true,
  timeout: DEFAULT_TIMEOUT_MS,
});

/**
 * Coalesces concurrent identical GETs into a single in-flight request.
 *
 * Exported so tests (and any future devtools panel) can inspect it.
 */
export const requestDeduplicator = createRequestDeduplicator();

export function getRequestReference(error) {
  return (
    error?.response?.data?.requestId ||
    error?.response?.headers?.["x-request-id"] ||
    error?.response?.headers?.["X-Request-ID"] ||
    null
  );
}

export function appendRequestReference(message, requestId) {
  if (!requestId) return message;

  const shortReference = String(requestId).slice(0, 12);
  return `${message} Reference: ${shortReference}`;
}

function applyFriendlyMessage(error, friendlyMessage) {
  if (!error.response) {
    error.response = { data: { message: friendlyMessage }, status: 0 };
  } else if (
    error.response.data &&
    typeof error.response.data === "object" &&
    !Array.isArray(error.response.data)
  ) {
    error.response.data.message = friendlyMessage;
  } else {
    error.response.data = { message: friendlyMessage };
  }
  error.message = friendlyMessage;
}

let clerkTokenGetter = null;

export const setClerkTokenGetter = (getterFn) => {
  clerkTokenGetter = getterFn;
};

/** Current Clerk session JWT for HTTP and Socket.IO auth */
export const getClerkBearerToken = async () => {
  if (!clerkTokenGetter || typeof clerkTokenGetter !== "function") {
    return null;
  }
  try {
    return await clerkTokenGetter();
  } catch (err) {
    console.warn("Failed to retrieve Clerk token", err);
    return null;
  }
};

/**
 * Socket.IO client options authenticated with the live Clerk session.
 */
export const createClerkSocketOptions = async (extra = {}) => {
  const token = await getClerkBearerToken();
  return {
    auth: token ? { token } : {},
    transports: ["websocket", "polling"],
    ...extra,
  };
};

const attachAuthorization = (headers, bearerValue) => {
  if (!headers) return;
  if (typeof headers.set === "function") {
    headers.set("Authorization", bearerValue);
    return;
  }
  headers.Authorization = bearerValue;
};

apiClient.interceptors.request.use(
  async (config) => {
    config.withCredentials = true;

    // Prefer an explicit Authorization already set by the caller (bootstrap).
    const existing =
      typeof config.headers?.get === "function"
        ? config.headers.get("Authorization")
        : config.headers?.Authorization;

    if (!existing) {
      const clerkToken = await getClerkBearerToken();
      if (clerkToken) {
        if (!config.headers) {
          config.headers = {};
        }
        attachAuthorization(config.headers, `Bearer ${clerkToken}`);
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error == null) {
      const friendlyMessage = "An unexpected error occurred. Please try again.";
      return Promise.reject({
        message: friendlyMessage,
        response: { data: { message: friendlyMessage }, status: 0 },
      });
    }

    const originalRequest = error.config;

    // ── Cancellation (Issue #978) ────────────────────────────────────────
    // We aborted this ourselves — the user typed another character, or
    // navigated away. Reject without rewriting the message, so callers can
    // recognise it and stay silent. Turning a deliberate abort into "Unable to
    // reach the server" would put an error toast on every keystroke.
    if (isCancellation(error)) {
      return Promise.reject(error);
    }

    // ── Bounded retry for safe requests (Issue #978) ──────────────────────
    // Only replay requests that are safe to replay. A dropped GET can be
    // re-issued freely; a dropped POST may already have been processed, and
    // re-sending it would create a duplicate — trading a visible error for a
    // silent double-write is worse than the error.
    if (originalRequest && isRetryable(error)) {
      const maxRetries =
        originalRequest.retries ?? DEFAULT_RETRY_CONFIG.retries;
      const attempt = (originalRequest._retryCount ?? 0) + 1;

      if (attempt <= maxRetries) {
        originalRequest._retryCount = attempt;

        const delayMs = computeRetryDelay(attempt, {
          ...DEFAULT_RETRY_CONFIG,
          // The backend sets `standardHeaders: true` on every limiter, so
          // RateLimit-Reset is genuinely present on a 429. Ignoring it (as the
          // client used to) guarantees the retry arrives too early and is
          // rejected again.
          retryAfterMs: getRetryAfterMs(error),
        });

        await sleep(delayMs);
        return apiClient.request(originalRequest);
      }
    }

    let friendlyMessage = "An unexpected error occurred. Please try again.";

    if (!error.response) {
      if (!navigator.onLine) {
        friendlyMessage =
          "Network offline. Please check your internet connection.";
      } else if (isTimeout(error)) {
        // Distinguished from a general connection failure: "the server is
        // taking too long" is actionable (wait, retry) in a way that "we can't
        // reach it" is not, and conflating them was previously the only
        // available outcome because there was no timeout at all.
        friendlyMessage =
          "The request timed out. The server is taking longer than expected — please try again.";
      } else {
        friendlyMessage =
          "Unable to reach the server. This may be a network issue or a CORS policy restriction.";
      }
    } else {
      switch (error.response.status) {
        case 401:
          friendlyMessage =
            error.response.data?.message ||
            "Session expired. Please log in again.";
          break;
        case 403:
          friendlyMessage =
            error.response.data?.message ||
            "You do not have permission to perform this action.";
          break;
        case 404:
          friendlyMessage = "The requested resource was not found.";
          break;
        // 429 deliberately has no case here. It falls through to the default
        // branch, which prefers the backend's own message — and the server
        // always sends one, which is more specific than anything hardcoded
        // here ("You can only request a data export once every 24 hours."
        // rather than a generic "too many requests").
        case 500:
        case 502:
        case 503:
        case 504:
          friendlyMessage = "Server unavailable. Please try again later.";
          break;
        default:
          if (error.response.data?.message) {
            friendlyMessage = error.response.data.message;
          }
          break;
      }
    }

    const status = error.response?.status;
    const requestId = getRequestReference(error);

    if (status >= 500) {
      friendlyMessage = appendRequestReference(friendlyMessage, requestId);
    }

    applyFriendlyMessage(error, friendlyMessage);
    return Promise.reject(error);
  },
);

// ─── In-flight de-duplication (Issue #978) ───────────────────────────────────
// Wrapping `request` rather than adding another interceptor, because an
// interceptor can only modify a request that has already been created — it
// can't return a *different, already-in-flight* promise in its place, which is
// the whole point of coalescing.
//
// Applies to idempotent reads only: two POSTs that look identical are two
// distinct intents and must never be collapsed into one.
const rawRequest = apiClient.request.bind(apiClient);

apiClient.request = function dedupedRequest(config = {}) {
  // A replay (retry) must bypass de-duplication. Its config still has the same
  // method/url/params as the original, so it would match the map entry for the
  // request it is replaying — and that entry is the outer promise, which has
  // not settled yet. The replay would then await itself and hang until the
  // caller's timeout.
  const isReplay = Boolean(config._retryCount || config._retry);
  if (isReplay) return rawRequest(config);

  return requestDeduplicator.run(config, () => rawRequest(config));
};

// axios's method helpers (`apiClient.get(...)`) build a config and call
// `Axios.prototype.request` internally rather than the instance property, so
// they bypass the override above. Re-point them at the deduped path so the
// benefit applies to every call site without any of them changing.
for (const method of ["get", "head", "options"]) {
  apiClient[method] = function dedupedMethod(url, config = {}) {
    return apiClient.request({ ...config, method, url });
  };
}

export default apiClient;
