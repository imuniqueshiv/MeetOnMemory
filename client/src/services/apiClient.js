import axios from "axios";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

const apiClient = axios.create({
  baseURL: backendUrl,
  withCredentials: true,
});

// Response Interceptor for global error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    let friendlyMessage = "An unexpected error occurred. Please try again.";

    // CSRF Retry Logic
    if (
      error.response &&
      error.response.status === 403 &&
      error.response.data &&
      error.response.data.message === "CSRF token validation failed."
    ) {
      const originalRequest = error.config;

      if (!originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const { data } = await axios.get(`${backendUrl}/api/csrf-token`, {
            withCredentials: true,
          });
          if (data && data.csrfToken) {
            // Update default headers and the original request
            apiClient.defaults.headers.common["X-CSRF-Token"] = data.csrfToken;
            originalRequest.headers["X-CSRF-Token"] = data.csrfToken;
            // Retry the request
            return apiClient(originalRequest);
          }
        } catch (csrfErr) {
          console.error("Failed to refresh CSRF token", csrfErr);
          friendlyMessage =
            "Session security token expired. Please refresh the page.";
        }
      } else {
        friendlyMessage =
          "Session security token expired. Please refresh the page.";
      }
    }

    if (!error.response) {
      // Network error (offline or server not reachable)
      if (!navigator.onLine) {
        friendlyMessage = "Network offline. Please check your internet connection.";
      } else {
        friendlyMessage = "Unable to reach the server. This may be a network issue or a CORS policy restriction.";
      }
      // Mock the response so local catch blocks using error.response?.data?.message work
      error.response = { data: { message: friendlyMessage }, status: 0 };
    } else {
      switch (error.response.status) {
        case 401:
          friendlyMessage =
            error.response.data && error.response.data.message
              ? error.response.data.message
              : "Session expired. Please log in again.";
          break;
        case 403:
          if (
            error.response.data?.message !== "CSRF token validation failed."
          ) {
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
          // Use backend provided message if available, otherwise keep default
          if (error.response.data && error.response.data.message) {
            friendlyMessage = error.response.data.message;
          }
          break;
      }

      // Inject the friendly message back into the response so local catch blocks display it
      if (error.response.data) {
        error.response.data.message = friendlyMessage;
      } else {
        error.response.data = { message: friendlyMessage };
      }
    }

    error.message = friendlyMessage;

    return Promise.reject(error);
  },
);

export default apiClient;
