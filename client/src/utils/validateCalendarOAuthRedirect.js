/**
 * Validate Calendar OAuth *provider* auth URLs before client-side navigation.
 * Only https destinations on approved Google / Microsoft OAuth hosts are allowed.
 * Returns the safe href, or null when the URL must not be followed.
 */
const ALLOWED_OAUTH_HOSTS = new Set([
  "accounts.google.com",
  "login.microsoftonline.com",
]);

export const CALENDAR_OAUTH_FALLBACK_PATH = "/settings";

export const validateCalendarOAuthAuthUrl = (url) => {
  if (!url || typeof url !== "string") {
    return null;
  }

  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") {
      return null;
    }
    if (!ALLOWED_OAUTH_HOSTS.has(parsed.hostname)) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
};
