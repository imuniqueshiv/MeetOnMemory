import axios from "axios";
import apiClient from "./apiClient";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

let csrfToken = null;
let inFlightFetch = null;

function applyToken(token) {
  csrfToken = token || null;

  if (csrfToken) {
    apiClient.defaults.headers.common["X-CSRF-Token"] = csrfToken;
  } else {
    delete apiClient.defaults.headers.common["X-CSRF-Token"];
  }

  return csrfToken;
}

export function getCsrfToken() {
  return csrfToken;
}

export function clearCsrfToken() {
  return applyToken(null);
}

export function getCsrfHeaders() {
  return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
}

// Merge CSRF headers into an axios request config
export function withCsrf(config = {}) {
  return {
    ...config,
    withCredentials: true,
    headers: {
      ...(config.headers || {}),
      ...getCsrfHeaders(),
    },
  };
}

async function requestToken() {
  const { data } = await axios.get(`${backendUrl}/api/csrf-token`, {
    withCredentials: true,
  });

  if (!data?.csrfToken) {
    throw new Error("CSRF token missing from response");
  }

  return applyToken(data.csrfToken);
}

// Fetch (or re-fetch) a token. Concurrent callers share one request.
export async function fetchCsrfToken() {
  if (inFlightFetch) return inFlightFetch;

  inFlightFetch = requestToken()
    .catch((err) => {
      clearCsrfToken();
      throw err;
    })
    .finally(() => {
      inFlightFetch = null;
    });

  return inFlightFetch;
}

export async function refreshCsrfToken() {
  return fetchCsrfToken();
}

export const csrfService = {
  fetchToken: fetchCsrfToken,
  refreshToken: refreshCsrfToken,
  getToken: getCsrfToken,
  clearToken: clearCsrfToken,
  getHeaders: getCsrfHeaders,
  withCsrf,
};
