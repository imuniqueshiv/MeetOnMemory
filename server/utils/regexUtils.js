/**
 * Regex helpers (Issue #1157).
 *
 * Seven call sites built a `RegExp` by interpolating user-controlled text
 * without escaping it. The helper to prevent that already existed — it just
 * lived in `utils/meetingSoftDelete.js`, which is not somewhere you look when
 * you are writing a tag uniqueness check.
 *
 * It lives here now, next to the other things that operate on patterns, and
 * `meetingSoftDelete.js` re-exports it so existing importers are unaffected.
 *
 * Two rules for anything that reaches for this module:
 *
 *   1. Interpolating a value into a `RegExp` without `escapeRegExp` is a bug.
 *      Not a style preference — the value decides whether the expression
 *      compiles at all (`"C++"` throws `SyntaxError: Nothing to repeat`) and
 *      what it matches if it does (`".*"` matches everything).
 *
 *   2. If what you actually want is case-insensitive *equality*, do not use a
 *      regex at all. Use `caseInsensitiveEquals` below, which produces a plain
 *      equality query plus a collation. It is index-friendly, it cannot be
 *      given a pathological pattern, and it says what it means.
 */

/**
 * Escapes every character that carries meaning inside a regular expression, so
 * the result matches `value` literally.
 *
 * @param {string} value
 * @returns {string}
 */
export const escapeRegExp = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Builds an anchored, case-insensitive regex that matches `value` literally.
 *
 * Prefer `caseInsensitiveEquals` for database queries — this is for the cases
 * where a `RegExp` object is genuinely required (string replacement, for
 * instance), not for `{ $regex: ... }` filters.
 *
 * @param {string} value
 * @param {string} [flags="i"]
 * @returns {RegExp}
 */
export const literalRegExp = (value, flags = "i") =>
  new RegExp(`^${escapeRegExp(value)}$`, flags);

/**
 * MongoDB collation for case- and diacritic-insensitive comparison.
 *
 * `strength: 2` compares base letters and accents but ignores case, which is
 * what "does a tag with this name already exist?" means in practice.
 */
export const CASE_INSENSITIVE_COLLATION = { locale: "en", strength: 2 };

/**
 * Expresses "this field equals `value`, ignoring case" as a query fragment
 * plus the collation it needs.
 *
 * Used as:
 *
 *   const { filter, collation } = caseInsensitiveEquals("name", name);
 *   await Tag.findOne({ organization, ...filter }).collation(collation);
 *
 * A regex cannot do this safely: `^value$` with the `i` flag is only equality
 * if `value` contains no metacharacters, which is precisely the assumption
 * that failed.
 *
 * @param {string} field
 * @param {string} value
 * @returns {{filter: object, collation: object}}
 */
export const caseInsensitiveEquals = (field, value) => ({
  filter: { [field]: String(value ?? "") },
  collation: CASE_INSENSITIVE_COLLATION,
});

/**
 * Builds a word-boundary replacement pattern for `value`.
 *
 * `\b` is a *boundary between* a word and a non-word character, so it does not
 * match where there is no word character to bound. `new RegExp("\\b#1\\b")`
 * matches nothing at all, because neither `#` nor the position before it is
 * preceded by a word character.
 *
 * Speaker labels are free text (`"#1"`, `"(host)"`, `"— unknown —"`), so the
 * boundary is applied only on the sides where it can actually mean something.
 * A label that starts or ends with a non-word character gets a lookaround that
 * asserts "not adjacent to a word character" instead, which is the same intent
 * expressed in a way that can match.
 *
 * @param {string} value
 * @param {string} [flags="g"]
 * @returns {RegExp}
 */
export const wordBoundaryRegExp = (value, flags = "g") => {
  const raw = String(value ?? "");
  const escaped = escapeRegExp(raw);

  const startsWithWordChar = /^\w/.test(raw);
  const endsWithWordChar = /\w$/.test(raw);

  const prefix = startsWithWordChar ? "\\b" : "(?<!\\w)";
  const suffix = endsWithWordChar ? "\\b" : "(?!\\w)";

  return new RegExp(`${prefix}${escaped}${suffix}`, flags);
};

export default {
  escapeRegExp,
  literalRegExp,
  caseInsensitiveEquals,
  wordBoundaryRegExp,
  CASE_INSENSITIVE_COLLATION,
};
