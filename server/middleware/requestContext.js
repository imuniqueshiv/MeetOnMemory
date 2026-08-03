import { randomUUID } from "node:crypto";
import logger, { sanitizeLogValue } from "../utils/logger.js";

export const REQUEST_ID_HEADER = "X-Request-ID";
export const MAX_REQUEST_ID_LENGTH = 128;

const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export function isValidRequestId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_REQUEST_ID_LENGTH &&
    SAFE_REQUEST_ID_PATTERN.test(value)
  );
}

export function resolveRequestId(incomingId) {
  return isValidRequestId(incomingId) ? incomingId : randomUUID();
}

/** Compatibility export used by security regression tests. */
export function redact(value) {
  return sanitizeLogValue(value);
}

export function buildLogContext(req) {
  if (!req) return {};

  const startedAt =
    typeof req.startedAt === "number" ? req.startedAt : Date.now();

  return {
    requestId: req.requestId || req.id || null,
    method: req.method || null,
    path: req.originalUrl || req.url || null,
    userId: req.user?.id || req.user?._id?.toString?.() || null,
    ip: req.ip || null,
    durationMs: Math.max(0, Date.now() - startedAt),
  };
}

function attachRequestIdToErrorJson(res, requestId) {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    if (
      res.statusCode >= 400 &&
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      payload.requestId == null
    ) {
      return originalJson({ ...payload, requestId });
    }

    return originalJson(payload);
  };
}

/** Attach request-scoped correlation data before any route can respond. */
export function requestContext(req, res, next) {
  const requestId = resolveRequestId(req.get(REQUEST_ID_HEADER));
  const startedAt = process.hrtime.bigint();

  req.requestId = requestId;
  req.id = requestId;
  req.startedAt = Date.now();
  req.log = logger.child(buildLogContext(req));

  res.setHeader(REQUEST_ID_HEADER, requestId);
  attachRequestIdToErrorJson(res, requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    req.log.info("HTTP request completed", {
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  next();
}

export default requestContext;
