import axios from "axios";
import { getCsrfToken, refreshCsrfToken } from "./csrfService.js";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

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
  } else if (error.response.data) {
    error.response.data.message = friendlyMessage;
  } else {
    error.response.data = { message: friendlyMessage };
  }
  error.message = friendlyMessage;
}

// Attach credentials + latest CSRF token on every request
apiClient.interceptors.request.use(
  (config) => {
    config.withCredentials = true;

    const token = getCsrfToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers["X-CSRF-Token"] = token;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
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
