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

export const DEFAULT_TIMEOUT_MS = 30000;

const apiClient = axios.create({
  baseURL: backendUrl,
  withCredentials: true,
  timeout: DEFAULT_TIMEOUT_MS,
});

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
let unauthorizedHandler = null;

export const setClerkTokenGetter = (getterFn) => {
  clerkTokenGetter = getterFn;
};

export const setUnauthorizedHandler = (handlerFn) => {
  unauthorizedHandler = handlerFn;
};

// Helper to determine if endpoint is an auth endpoint where 401 is an expected credential error
const isAuthEndpoint = (url = "") => {
  const normalizedUrl = String(url).toLowerCase();
  return (
    normalizedUrl.includes("/api/auth/login") ||
    normalizedUrl.includes("/api/auth/register") ||
    normalizedUrl.includes("/api/auth/send-verify-otp") ||
    normalizedUrl.includes("/api/auth/verify-account")
  );
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

    if (isCancellation(error)) {
      return Promise.reject(error);
    }

    if (originalRequest && isRetryable(error)) {
      const maxRetries =
        originalRequest.retries ?? DEFAULT_RETRY_CONFIG.retries;
      const attempt = (originalRequest._retryCount ?? 0) + 1;

      if (attempt <= maxRetries) {
        originalRequest._retryCount = attempt;

        const delayMs = computeRetryDelay(attempt, {
          ...DEFAULT_RETRY_CONFIG,
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

          // Graceful handling of token expiration on protected requests
          if (!isAuthEndpoint(originalRequest?.url)) {
            if (typeof window !== "undefined") {
              try {
                localStorage.removeItem("token");
                localStorage.removeItem("userData");
                window.dispatchEvent(new CustomEvent("auth:expired"));
              } catch {
                // Ignore storage errors
              }

              if (typeof unauthorizedHandler === "function") {
                unauthorizedHandler(error);
              }
            }
          }
          break;
        case 403:
          friendlyMessage =
            error.response.data?.message ||
            "You do not have permission to perform this action.";
          break;
        case 404:
          friendlyMessage = "The requested resource was not found.";
          break;
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

const rawRequest = apiClient.request.bind(apiClient);

apiClient.request = function dedupedRequest(config = {}) {
  const isReplay = Boolean(config._retryCount || config._retry);
  if (isReplay) return rawRequest(config);

  return requestDeduplicator.run(config, () => rawRequest(config));
};

for (const method of ["get", "head", "options"]) {
  apiClient[method] = function dedupedMethod(url, config = {}) {
    return apiClient.request({ ...config, method, url });
  };
}

export default apiClient;
