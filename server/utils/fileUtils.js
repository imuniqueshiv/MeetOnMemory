import path from "path";

export const validatePath = (filePath) => {
  if (!filePath) throw new Error("Path is required");
  const resolved = path.resolve(filePath);
  const uploadsDir = path.resolve(process.env.UPLOADS_DIR || "uploads");
  const relative = path.relative(uploadsDir, resolved);
  if (
    relative === ".." ||
    relative.startsWith(".." + path.sep) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Directory traversal detected: Access denied");
  }
  return resolved;
};

/**
 * Sanitizes a filename for safe use in Content-Disposition headers.
 * Prevents header injection by removing or escaping unsafe characters.
 *
 * Removes:
 * - Carriage returns (\r) and line feeds (\n)
 * - Control characters (0x00-0x1F, 0x7F)
 * - Quotes (only double quotes)
 * - Backslashes
 *
 * Preserves valid filename characters while ensuring RFC-compliant headers.
 *
 * @param {string} filename - The filename to sanitize
 * @returns {string} The sanitized filename safe for use in Content-Disposition headers
 */
export const sanitizeFilenameForHeader = (filename) => {
  if (!filename) return "";

  return (
    filename
      // Remove carriage returns and line feeds (prevents header injection)
      .replace(/[\r\n]/g, "")
      // Remove control characters (0x00-0x1F and 0x7F)
      .replace(/[\x00-\x1F\x7F]/g, "")
      // Remove double quotes
      .replace(/"/g, "")
      // Remove backslashes
      .replace(/\\/g, "")
  );
};

/**
 * Name used when a filename sanitizes down to nothing (Issue #1454).
 *
 * `sanitizeFilenameForHeader` strips quotes, backslashes and control
 * characters, so a name made only of those — `"""`, or a lone `\r\n` — reduces
 * to `""`. Emitting `filename=""` makes the browser fall back to the last URL
 * path segment, which for these routes is an ObjectId. A neutral placeholder is
 * more useful than a 24-character hex string.
 */
export const FALLBACK_DOWNLOAD_FILENAME = "download";

/**
 * Generates an RFC 8187 compliant Content-Disposition header value.
 * Supports Unicode filenames safely.
 *
 * Two parameters are emitted on purpose:
 *
 *   - `filename="..."` — the sanitized ASCII form, for clients that do not
 *     implement RFC 5987/8187.
 *   - `filename*=UTF-8''...` — the percent-encoded original, which every
 *     current browser prefers. This is what keeps `स्थिति-रिपोर्ट.pdf` intact
 *     instead of arriving as mojibake.
 *
 * `encodeURIComponent` is applied to the *raw* name rather than the sanitized
 * one so nothing is lost from the parameter clients actually use; percent
 * encoding neutralises CR, LF and quotes on its own, so this cannot inject a
 * header either.
 *
 * @param {string} filename - The original filename
 * @param {object} [options]
 * @param {string} [options.fallback=FALLBACK_DOWNLOAD_FILENAME]
 * @returns {string} The formatted header value
 */
export const getContentDispositionHeader = (
  filename,
  {
    fallback = FALLBACK_DOWNLOAD_FILENAME,
    dispositionType = "attachment",
  } = {},
) => {
  const raw = typeof filename === "string" ? filename : "";
  const safeAscii = sanitizeFilenameForHeader(raw).trim() || fallback;
  const encoded = encodeURIComponent(raw || fallback);

  return `${dispositionType}; filename="${safeAscii}"; filename*=UTF-8''${encoded}`;
};
