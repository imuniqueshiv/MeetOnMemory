export const CSRF_INVALID = "CSRF_INVALID";

export const CSRF_INVALID_MESSAGE = "CSRF token validation failed.";

export function buildCsrfInvalidResponse(
  message = CSRF_INVALID_MESSAGE,
  requestId,
) {
  return {
    success: false,
    code: CSRF_INVALID,
    message,
    ...(requestId ? { requestId } : {}),
  };
}

export function sendCsrfInvalid(res, requestId) {
  return res
    .status(403)
    .json(buildCsrfInvalidResponse(CSRF_INVALID_MESSAGE, requestId));
}
