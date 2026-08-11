/**
 * Shared pagination parsing (Issue #1071).
 *
 * Several list endpoints read `?page=` and `?limit=` with
 * `parseInt(req.query.limit) || <default>` and passed the result straight to
 * `.skip()` / `.limit()`. Three things went wrong with that:
 *
 *   - **No ceiling.** `?limit=10000000` streamed millions of documents into
 *     the Node heap, ran `.populate()` over all of them and serialized the lot
 *     to JSON. One request was enough to push a container past its memory
 *     limit and take the API down for every tenant.
 *   - **No floor.** `?page=0` produced `skip = -limit`; MongoDB rejects a
 *     negative skip, and the controllers reported that validation problem as a
 *     generic 500.
 *   - **Accidental parsing.** `parseInt(x) || d` leans on NaN being falsy, so
 *     it also swallows a deliberate `0`, and without a radix `"1e5"` parses as
 *     `1` — quietly ignoring what the caller asked for.
 *
 * The rule already existed in the codebase — `knowledgeController` clamps to
 * 100, `decisionGraphController` to 200, `notificationController` to 100 — but
 * it was written three different ways and missed in four places. This is that
 * rule, once.
 *
 * Out-of-range values are **clamped, not rejected**. Existing clients that ask
 * for `limit=500` keep working and receive a capped page; turning that into a
 * 400 would break them for no security benefit. Genuinely malformed input
 * (`?limit=abc`) falls back to the endpoint's default, matching the previous
 * behaviour.
 */

/** Ceiling applied when an endpoint does not specify its own. */
export const DEFAULT_MAX_LIMIT = 100;

/** Page size used when the caller does not ask for one. */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Parses a value that should be a positive integer.
 *
 * Returns `null` for anything that is not one — including `NaN`, `Infinity`,
 * floats, negatives and values with trailing junk — so the caller can tell
 * "absent or unusable" apart from a real `0`.
 */
const parsePositiveInteger = (raw) => {
  if (raw === undefined || raw === null || raw === "") return null;

  // Arrays arrive when a query key is repeated (`?limit=5&limit=9`). Take the
  // last one, which is what Express itself would surface for a scalar param.
  const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;

  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  // Digits only: rejects "1e5", "12abc", "-3", " 4.5 " and hex/octal literals.
  if (!/^\d+$/.test(trimmed)) return null;

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Normalizes `?page=` and `?limit=` into values that are always safe to pass
 * to Mongoose.
 *
 * @param {object} query                 `req.query`
 * @param {object} [options]
 * @param {number} [options.defaultLimit] page size when none is requested
 * @param {number} [options.maxLimit]     hard ceiling for this endpoint
 * @returns {{page: number, limit: number, skip: number, limitWasClamped: boolean}}
 *   `page >= 1`, `1 <= limit <= maxLimit`, `skip >= 0` — always.
 */
export const parsePagination = (query = {}, options = {}) => {
  const maxLimit = Math.max(1, options.maxLimit ?? DEFAULT_MAX_LIMIT);
  const defaultLimit = Math.min(
    Math.max(1, options.defaultLimit ?? DEFAULT_PAGE_SIZE),
    maxLimit,
  );

  const page = parsePositiveInteger(query.page) ?? 1;

  const requestedLimit = parsePositiveInteger(query.limit);
  const limit =
    requestedLimit === null ? defaultLimit : Math.min(requestedLimit, maxLimit);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    limitWasClamped: requestedLimit !== null && requestedLimit > maxLimit,
  };
};

/**
 * Builds the response envelope that goes alongside a page of results.
 *
 * `hasMore` is the piece worth having: without it a client cannot distinguish
 * a full page from the last page, and its only recourse is to keep asking for
 * larger limits — the exact behaviour the ceiling is there to prevent.
 */
export const buildPaginationMeta = ({ total, page, limit }) => ({
  total,
  page,
  limit,
  totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  hasMore: page * limit < total,
});
