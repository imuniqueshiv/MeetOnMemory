/**
 * Shared-link passcode lockout (Issue #1111).
 *
 * Complements the HTTP `loginLimiter` on POST /api/public/shared/:hash/verify:
 * the rate limiter caps requests per IP, while these settings lock a specific
 * link after consecutive wrong passcodes — even across IPs or limiter windows.
 *
 * Defaults mirror the login limiter (5 failures / 15 minutes) so operators get
 * a consistent brute-force posture. Override with env when needed.
 */

const parsePositiveInt = (raw, fallback) => {
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

/** Consecutive failures before the link is temporarily locked. */
export const SHARED_LINK_PASSCODE_MAX_ATTEMPTS = parsePositiveInt(
  process.env.SHARED_LINK_PASSCODE_MAX_ATTEMPTS,
  5,
);

/** How long a lockout lasts once the threshold is reached. */
export const SHARED_LINK_PASSCODE_LOCKOUT_MS = parsePositiveInt(
  process.env.SHARED_LINK_PASSCODE_LOCKOUT_MS,
  15 * 60 * 1000,
);

/**
 * Generic failure message for wrong passcodes *and* active lockouts.
 * Intentionally identical so clients cannot distinguish the two cases.
 */
export const SHARED_LINK_PASSCODE_AUTH_FAILURE_MESSAGE = "Incorrect passcode";

export const isPasscodeLocked = (link, now = new Date()) =>
  Boolean(link?.passcodeLockUntil && new Date(link.passcodeLockUntil) > now);

export const hasPasscodeLockExpired = (link, now = new Date()) =>
  Boolean(link?.passcodeLockUntil && new Date(link.passcodeLockUntil) <= now);
