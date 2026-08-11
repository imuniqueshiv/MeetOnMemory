import { AppError } from "../utils/errors.js";
import { sendCsrfInvalid } from "../utils/csrfErrors.js";
import logger from "../utils/logger.js";

function isZodError(err) {
  return (
    err instanceof Error && err.name === "ZodError" && Array.isArray(err.issues)
  );
}

function isMalformedJsonError(err) {
  return (
    err instanceof SyntaxError &&
    err.status === 400 &&
    err.type === "entity.parse.failed"
  );
}

function isPayloadTooLargeError(err) {
  return err?.status === 413 || err?.type === "entity.too.large";
}

function withRequestId(req, payload) {
  return { ...payload, requestId: req?.requestId };
}

function getRequestLogger(req) {
  return req?.log || logger.child({ requestId: req?.requestId });
}

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const requestLog = getRequestLogger(req);

  if (err?.code === "EBADCSRFTOKEN") {
    requestLog.warn("CSRF validation failed", { statusCode: 403 });
    return sendCsrfInvalid(res, req?.requestId);
  }

  if (isMalformedJsonError(err)) {
    requestLog.warn("Malformed JSON request body", { statusCode: 400 });
    return res.status(400).json(
      withRequestId(req, {
        success: false,
        message: "Invalid JSON payload.",
      }),
    );
  }

  if (isPayloadTooLargeError(err)) {
    requestLog.warn("Request payload too large", { statusCode: 413 });
    return res.status(413).json(
      withRequestId(req, {
        success: false,
        message: "Request payload is too large.",
      }),
    );
  }

  if (isZodError(err)) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    requestLog.warn("Request validation failed", { statusCode: 400, details });
    return res.status(400).json(
      withRequestId(req, {
        success: false,
        message: "Validation failed.",
        details,
      }),
    );
  }

  if (err instanceof AppError) {
    const payload = { success: false, message: err.message };
    if (err.details) payload.details = err.details;
    requestLog.warn("Handled application error", {
      statusCode: err.statusCode,
      errorName: err.name,
    });
    return res.status(err.statusCode).json(withRequestId(req, payload));
  }

  if (err?.name === "ValidationError" && err.errors) {
    const details = Object.values(err.errors).map((error) => ({
      field: error.path,
      message: error.message,
    }));
    requestLog.warn("Mongoose validation failed", { statusCode: 400, details });
    return res.status(400).json(
      withRequestId(req, {
        success: false,
        message: "Invalid data provided.",
        details,
      }),
    );
  }

  if (err?.name === "CastError") {
    requestLog.warn("Invalid database identifier", {
      statusCode: 400,
      field: err.path,
    });
    return res.status(400).json(
      withRequestId(req, {
        success: false,
        message: `Invalid value for field '${err.path}'.`,
      }),
    );
  }

  requestLog.error("Unhandled request error", err, { statusCode: 500 });

  const isProd = process.env.NODE_ENV === "production";
  return res.status(500).json(
    withRequestId(req, {
      success: false,
      message: isProd
        ? "Internal Server Error"
        : err?.message || "Internal Server Error",
      ...(isProd ? {} : { stack: err?.stack }),
    }),
  );
};

export default errorHandler;
