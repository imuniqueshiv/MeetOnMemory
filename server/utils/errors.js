/**
 * Custom Application Error Hierarchy
 *
 * All operational errors thrown by services should extend AppError so that
 * the global error handler (middleware/errorHandler.js) can map them to the
 * correct HTTP status code without leaking internal stack traces to clients.
 *
 *   AppError (base)
 *   ├── ValidationError  → 400  (bad input / Zod schema failure)
 *   ├── UnauthorizedError → 401 (not authenticated)
 *   ├── ForbiddenError    → 403 (authenticated but not permitted)
 *   ├── ConflictError     → 409 (resource already exists / state conflict)
 *   └── NotFoundError     → 404 (resource doesn't exist)
 */

export class AppError extends Error {
  /**
   * @param {string} message       - Human-readable error description
   * @param {number} statusCode    - HTTP status code to send back
   * @param {boolean} isOperational - true = expected failure (bad input, not found);
   *                                  false = programming bug (should never happen)
   */
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    // Captures stack trace without this constructor cluttering it
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ──────────────────────────────────────────────────────────────
// 400 Bad Request — invalid or missing input data
// ──────────────────────────────────────────────────────────────
export class ValidationError extends AppError {
  /**
   * @param {string}  message - Readable error message
   * @param {Array}   details - Optional array of field-level issues (e.g. from Zod)
   */
  constructor(message = "Validation failed", details = null) {
    super(message, 400);
    this.details = details;
  }
}

// ──────────────────────────────────────────────────────────────
// 401 Unauthorized — request missing valid authentication
// ──────────────────────────────────────────────────────────────
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized. Login required.") {
    super(message, 401);
  }
}

// ──────────────────────────────────────────────────────────────
// 403 Forbidden — authenticated but lacks permission
// ──────────────────────────────────────────────────────────────
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, 403);
  }
}

// ──────────────────────────────────────────────────────────────
// 409 Conflict — resource already exists or state conflict
// ──────────────────────────────────────────────────────────────
export class ConflictError extends AppError {
  constructor(message = "Resource already exists.") {
    super(message, 409);
  }
}

// ──────────────────────────────────────────────────────────────
// 404 Not Found — requested resource does not exist
// ──────────────────────────────────────────────────────────────
export class NotFoundError extends AppError {
  constructor(message = "Resource not found.") {
    super(message, 404);
  }
}
