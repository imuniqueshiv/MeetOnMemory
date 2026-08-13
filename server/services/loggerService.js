/**
 * Structured Logging Service
 * Provides logging with levels, colors, and request tracking
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// LOG LEVELS
// ============================================================================

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

const LOG_COLORS = {
  error: "\x1b[31m", // Red
  warn: "\x1b[33m", // Yellow
  info: "\x1b[36m", // Cyan
  debug: "\x1b[32m", // Green
  trace: "\x1b[90m", // Gray
  reset: "\x1b[0m",
};

// ============================================================================
// LOGGER CLASS
// ============================================================================

class Logger {
  constructor(options = {}) {
    this.level = options.level || process.env.LOG_LEVEL || "info";
    this.logToFile = options.logToFile || false;
    this.logFilePath = options.logFilePath || path.join(__dirname, "../logs/app.log");
    this.logToConsole = options.logToConsole !== false;
    this.requestId = null;

    // Create logs directory if it doesn't exist
    if (this.logToFile) {
      const logDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }

  _shouldLog(level) {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
  }

  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const requestId = this.requestId || meta.requestId || "-";
    const color = LOG_COLORS[level] || "";
    const reset = LOG_COLORS.reset;

    // Format meta
    let metaStr = "";
    if (Object.keys(meta).length > 0) {
      const metaCopy = { ...meta };
      delete metaCopy.requestId;
      if (Object.keys(metaCopy).length > 0) {
        metaStr = " " + JSON.stringify(metaCopy);
      }
    }

    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${requestId}] ${message}${metaStr}`;

    return {
      plain: logMessage,
      colored: `${color}${logMessage}${reset}`,
    };
  }

  _log(level, message, meta = {}) {
    if (!this._shouldLog(level)) return;

    const formatted = this._formatMessage(level, message, meta);

    // Console output
    if (this.logToConsole) {
      console.log(formatted.colored);
    }

    // File output
    if (this.logToFile) {
      try {
        fs.appendFileSync(this.logFilePath, formatted.plain + "\n");
      } catch (error) {
        console.error("Failed to write to log file:", error);
      }
    }
  }

  error(message, meta = {}) {
    this._log("error", message, meta);
  }

  warn(message, meta = {}) {
    this._log("warn", message, meta);
  }

  info(message, meta = {}) {
    this._log("info", message, meta);
  }

  debug(message, meta = {}) {
    this._log("debug", message, meta);
  }

  trace(message, meta = {}) {
    this._log("trace", message, meta);
  }

  // ========================================================================
  // REQUEST TRACKING
  // ========================================================================

  setRequestId(requestId) {
    this.requestId = requestId;
  }

  clearRequestId() {
    this.requestId = null;
  }

  withRequestId(requestId, callback) {
    const previousId = this.requestId;
    this.setRequestId(requestId);
    try {
      return callback();
    } finally {
      this.setRequestId(previousId);
    }
  }

  // ========================================================================
  // CHILD LOGGER
  // ========================================================================

  child(meta) {
    const childLogger = new Logger({
      level: this.level,
      logToFile: this.logToFile,
      logFilePath: this.logFilePath,
      logToConsole: this.logToConsole,
    });
    childLogger._parentMeta = meta;
    return childLogger;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let loggerInstance = null;

export function getLogger() {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}

export default getLogger();