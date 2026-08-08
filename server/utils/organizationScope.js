/**
 * Organization identity comparison (Issue #1272).
 *
 * Organization references reach controllers in two shapes. `req.user.organization`
 * is a Mongoose `ObjectId` populated by `userAuth`; `document.organization` is
 * also an `ObjectId`, but the moment either side passes through `JSON.stringify`,
 * a route parameter, or a `.lean()` projection it becomes a string.
 *
 * `a !== b` is therefore not a usable test — two references to the same
 * organization compare unequal whenever their shapes differ, which is exactly
 * how the report template handlers ended up rejecting every template in the
 * caller's own organization:
 *
 *     template.organization.toString() !== orgId   // string !== ObjectId → always true
 *
 * A `!==` between an `ObjectId` and a string is silent — no throw, no warning,
 * just a branch that is always taken. Routing every comparison through this
 * helper removes the shape from the question.
 */

/**
 * Reduces an organization reference to a comparable string.
 *
 * Accepts an `ObjectId`, a string, or a populated document (in which case the
 * document's `_id` is used). Returns `null` for anything that cannot identify
 * an organization, so a missing value never compares equal to another missing
 * value.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export const toOrganizationId = (value) => {
  if (value === null || value === undefined) return null;

  // A populated ref: prefer its _id over the document's own toString().
  if (
    typeof value === "object" &&
    value._id !== undefined &&
    value._id !== null
  ) {
    return String(value._id);
  }

  const id = String(value);
  return id.length > 0 ? id : null;
};

/**
 * True when both references identify the same organization.
 *
 * Two absent references are **not** the same organization — a user without an
 * organization must never match a document without one.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export const isSameOrganization = (a, b) => {
  const left = toOrganizationId(a);
  const right = toOrganizationId(b);

  if (left === null || right === null) return false;

  return left === right;
};

export default { toOrganizationId, isSameOrganization };
