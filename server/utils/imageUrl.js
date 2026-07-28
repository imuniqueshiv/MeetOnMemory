/**
 * Shared image URL helpers for organization branding (logo / banner).
 * Kept URL-based so future upload flows can store CDN URLs in the same fields.
 */

const MAX_IMAGE_URL_LENGTH = 2048;

/**
 * Validate an optional http(s) URL used for branding images.
 * Empty string is allowed (clears branding / uses placeholder).
 * @param {unknown} value
 * @param {string} fieldLabel
 * @returns {{ ok: true, value: string } | { ok: false, message: string }}
 */
export function normalizeImageUrl(value, fieldLabel = "Image URL") {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }

  const trimmed = String(value).trim();
  if (trimmed === "") {
    return { ok: true, value: "" };
  }

  if (trimmed.length > MAX_IMAGE_URL_LENGTH) {
    return {
      ok: false,
      message: `${fieldLabel} cannot exceed ${MAX_IMAGE_URL_LENGTH} characters.`,
    };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      message: `${fieldLabel} must be a valid URL starting with http:// or https://.`,
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      message: `${fieldLabel} must use http or https.`,
    };
  }

  return { ok: true, value: trimmed };
}

export { MAX_IMAGE_URL_LENGTH };
