export const CSRF_INVALID = "CSRF_INVALID";

export const CSRF_INVALID_MESSAGE = "CSRF token validation failed.";

export function buildCsrfInvalidResponse(message = CSRF_INVALID_MESSAGE) {
  return {
    success: false,
    code: CSRF_INVALID,
    message,
  };
}

export function sendCsrfInvalid(res) {
  return res.status(403).json(buildCsrfInvalidResponse());
}
