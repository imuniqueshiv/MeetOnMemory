/**
 * Client-side image URL helpers for organization branding.
 * Mirrors server/utils/imageUrl.js so future upload CDN URLs reuse the same fields.
 */

export const MAX_IMAGE_URL_LENGTH = 2048;

/**
 * @param {string} value
 * @param {string} fieldLabel
 * @returns {string} error message or ""
 */
export function validateImageUrl(value, fieldLabel = "Image URL") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  if (trimmed.length > MAX_IMAGE_URL_LENGTH) {
    return `${fieldLabel} cannot exceed ${MAX_IMAGE_URL_LENGTH} characters.`;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return `${fieldLabel} must use http or https.`;
    }
  } catch {
    return `${fieldLabel} must be a valid URL starting with http:// or https://.`;
  }

  return "";
}

/**
 * Sanitize potentially untrusted image URLs before rendering in the DOM.
 * Returns empty string for unsupported or malformed URLs so UI falls back
 * to placeholders instead of attempting to render unsafe schemes.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeImageUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.length > MAX_IMAGE_URL_LENGTH) return "";

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return trimmed;
    }
  } catch {
    return "";
  }

  return "";
}
