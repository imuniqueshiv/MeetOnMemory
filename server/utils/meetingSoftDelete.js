export const ACTIVE_MEETING_FILTER = {
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};

export const withActiveMeetings = (filter = {}) => ({
  $and: [filter, ACTIVE_MEETING_FILTER],
});

export const deletedMeetingsFilter = (filter = {}) => ({
  ...filter,
  deletedAt: { $ne: null },
});

/**
 * Re-exported for backwards compatibility (Issue #1157).
 *
 * `escapeRegExp` has nothing to do with soft deletion, and living here is a
 * large part of why seven other call sites never found it. It now lives in
 * `utils/regexUtils.js`; this re-export keeps existing importers working.
 */
export { escapeRegExp } from "./regexUtils.js";
