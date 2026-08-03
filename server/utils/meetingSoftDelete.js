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

export const escapeRegExp = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
