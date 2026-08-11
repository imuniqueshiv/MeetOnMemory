// server/utils/logger.js

const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|password|passwd|secret|token|api[-_]?key|access[-_]?token|refresh[-_]?token|file|upload|buffer|binary/i;
const MAX_REDACTION_DEPTH = 5;
const MAX_STRING_LENGTH = 2000;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 100;

function isBinaryValue(value) {
  return (
    (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  );
}

function isFileLike(value) {
  return (
    value &&
    typeof value === "object" &&
    ("originalname" in value || "mimetype" in value || "fieldname" in value) &&
    ("buffer" in value || "path" in value || "stream" in value)
  );
}

export function sanitizeLogValue(value, depth = 0, seen = new WeakSet()) {
  if (
    value == null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…[TRUNCATED]`
      : value;
  }

  if (typeof value !== "object") return String(value);
  if (isBinaryValue(value) || isFileLike(value)) return "[REDACTED]";
  if (depth >= MAX_REDACTION_DEPTH) return "[MAX_DEPTH]";
  if (seen.has(value)) return "[CIRCULAR]";

  seen.add(value);

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeLogValue(item, depth + 1, seen));

    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`[${value.length - MAX_ARRAY_ITEMS} MORE ITEMS]`);
    }

    return items;
  }

  const entries = Object.entries(value);
  const sanitized = {};

  for (const [key, nestedValue] of entries.slice(0, MAX_OBJECT_KEYS)) {
    sanitized[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? "[REDACTED]"
      : sanitizeLogValue(nestedValue, depth + 1, seen);
  }

  if (entries.length > MAX_OBJECT_KEYS) {
    sanitized.__truncatedKeys = entries.length - MAX_OBJECT_KEYS;
  }

  return sanitized;
}

class Logger {
  constructor(context = {}) {
    this.context = sanitizeLogValue(context);
  }

  child(context = {}) {
    return new Logger({ ...this.context, ...sanitizeLogValue(context) });
  }

  formatMessage(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...sanitizeLogValue(meta),
    });
  }

  info(message, meta = {}) {
    console.log(this.formatMessage("info", message, meta));
  }

  warn(message, meta = {}) {
    console.warn(this.formatMessage("warn", message, meta));
  }

  error(message, error = null, meta = {}) {
    const errorDetails =
      error instanceof Error
        ? {
            errorName: error.name,
            errorMessage: error.message,
            stack: error.stack,
          }
        : error
          ? { errorMessage: String(error) }
          : {};

    console.error(
      this.formatMessage("error", message, { ...meta, ...errorDetails }),
    );
  }
}

export { Logger };
export default new Logger();
