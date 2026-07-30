import axios from "axios";
import { getCsrfToken, refreshCsrfToken } from "./csrfService.js";
import { getBackendUrl } from "../config/backendConfig.js";

const backendUrl = getBackendUrl();

const apiClient = axios.create({
  baseURL: backendUrl,
  withCredentials: true,
});

const CSRF_FAILED_MESSAGE = "CSRF token validation failed.";

function isCsrfError(error) {
  const status = error.response?.status;
  const message = error.response?.data?.message;
  return status === 419 || (status === 403 && message === CSRF_FAILED_MESSAGE);
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

// Attach credentials + latest CSRF token + Clerk token on every request
apiClient.interceptors.request.use(
  async (config) => {
    config.withCredentials = true;
    config.headers = config.headers || {};

    if (clerkTokenGetter && typeof clerkTokenGetter === "function") {
      try {
        const clerkToken = await clerkTokenGetter();
        if (clerkToken) {
          config.headers["Authorization"] = `Bearer ${clerkToken}`;
        }
      } catch (err) {
        console.warn("Failed to retrieve Clerk token for API request", err);
      }
    }

    const token = getCsrfToken();
    if (token) {
      config.headers["X-CSRF-Token"] = token;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Guard against null/undefined so malformed reject payloads never crash.
    if (error == null) {
      const friendlyMessage = "An unexpected error occurred. Please try again.";
      return Promise.reject({
        message: friendlyMessage,
        response: { data: { message: friendlyMessage }, status: 0 },
      });
    }

    const originalRequest = error.config;
    let friendlyMessage = "An unexpected error occurred. Please try again.";

    // Refresh CSRF once, then retry the failed request
    if (isCsrfError(error) && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await refreshCsrfToken();
        const token = getCsrfToken();

        if (token) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers["X-CSRF-Token"] = token;
          return apiClient.request(originalRequest);
        }

        friendlyMessage =
          "Session security token expired. Please refresh the page.";
      } catch (csrfErr) {
        console.error("Failed to refresh CSRF token", csrfErr);
        friendlyMessage =
          "Session security token expired. Please refresh the page.";
      }
    } else if (isCsrfError(error) && originalRequest?._retry) {
      friendlyMessage =
        "Session security token expired. Please refresh the page.";
    } else if (!error.response) {
      if (!navigator.onLine) {
        friendlyMessage =
          "Network offline. Please check your internet connection.";
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
          if (error.response.data?.message !== CSRF_FAILED_MESSAGE) {
            friendlyMessage =
              "You do not have permission to perform this action.";
          }
          break;
        case 404:
          friendlyMessage = "The requested resource was not found.";
          break;
        case 419:
          friendlyMessage = "Session expired (CSRF). Please refresh the page.";
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

    applyFriendlyMessage(error, friendlyMessage);
    return Promise.reject(error);
  },
);

export default apiClient;
