/**
 * Centralized Backend URL Resolution Utility
 *
 * Provides zero-configuration backend URL resolution for MeetOnMemory frontend.
 * Resolution Order:
 * 1. import.meta.env.VITE_BACKEND_URL
 * 2. import.meta.env.VITE_API_URL
 * 3. Fallback: "http://localhost:4000"
 */

export const DEFAULT_BACKEND_URL = "http://localhost:4000";

let hasWarned = false;

/**
 * Resolves the backend API base URL.
 * Emits a console warning in development mode when falling back to default URL.
 *
 * @returns {string} Clean backend URL without trailing slashes.
 */
export const getBackendUrl = () => {
  const envUrl =
    (typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL
      : null) || "";

  if (envUrl && typeof envUrl === "string" && envUrl.trim() !== "") {
    return envUrl.trim().replace(/\/+$/, "");
  }

  // If running in Vite development mode without an env variable, output a helpful warning once
  if (
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.DEV &&
    !hasWarned
  ) {
    console.warn(
      `[MeetOnMemory] VITE_BACKEND_URL is not set. Automatically connecting to default backend: ${DEFAULT_BACKEND_URL}`,
    );
    hasWarned = true;
  }

  return DEFAULT_BACKEND_URL;
};

export const BACKEND_URL = getBackendUrl();

export default getBackendUrl;
