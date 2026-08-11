/**
 * Build a post–Calendar-OAuth redirect back into the app.
 * Only relative internal paths are allowed; CLIENT_URL is used as origin only.
 */

const DEFAULT_ORIGIN = "http://localhost:5173";
export const CALENDAR_OAUTH_CLIENT_FALLBACK_PATH = "/settings";

export const validateInternalAppPath = (
  path,
  fallback = CALENDAR_OAUTH_CLIENT_FALLBACK_PATH,
) => {
  if (!path || typeof path !== "string") {
    return fallback;
  }

  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  try {
    // Absolute URLs parse without a base — reject them.
    new URL(trimmed);
    return fallback;
  } catch {
    return trimmed;
  }
};

export const getTrustedClientOrigin = () => {
  try {
    const base = new URL(process.env.CLIENT_URL || DEFAULT_ORIGIN);
    if (base.protocol !== "http:" && base.protocol !== "https:") {
      return DEFAULT_ORIGIN;
    }
    return base.origin;
  } catch {
    return DEFAULT_ORIGIN;
  }
};

export const buildCalendarOAuthClientRedirect = (
  pathWithQuery = CALENDAR_OAUTH_CLIENT_FALLBACK_PATH,
) => {
  const safePath = validateInternalAppPath(
    pathWithQuery,
    CALENDAR_OAUTH_CLIENT_FALLBACK_PATH,
  );
  return `${getTrustedClientOrigin()}${safePath}`;
};
