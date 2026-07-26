// server/utils/logger.js

/**
 * A lightweight internal structured logger utility.
 * Outputs logs in JSON format for easy ingestion by monitoring tools.
 */
class Logger {
  formatMessage(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    });
  }

  info(message, meta = {}) {
    console.log(this.formatMessage("info", message, meta));
  }

  warn(message, meta = {}) {
    console.warn(this.formatMessage("warn", message, meta));
  }

  error(message, error = null, meta = {}) {
    const errorDetails = error instanceof Error ? {
      errorMessage: error.message,
      stack: error.stack,
    } : (error ? { errorMessage: String(error) } : {});
    
    console.error(this.formatMessage("error", message, { ...meta, ...errorDetails }));
  }
}

export default new Logger();
