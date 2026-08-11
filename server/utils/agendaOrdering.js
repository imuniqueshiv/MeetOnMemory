const getAgendaText = (item) =>
  typeof item?.text === "string"
    ? item.text.trim()
    : typeof item?.title === "string"
      ? item.title.trim()
      : "";

/**
 * Reorders agenda items and assigns contiguous `position` values.
 *
 * This runs from `meetingSchema.pre("validate")` on every modification, so it
 * sees the live subdocuments — including the timer fields added for
 * Issue #1159 (`status`, `startedAt`, `completedAt`, `actualDuration`). It must
 * therefore preserve every field it does not own. The `...item` spread below is
 * what guarantees that; replacing it with an explicit field list would strip
 * the timer state on every save, reproducing the original bug from the other
 * direction.
 */
export const normalizeAgendaItems = (items = []) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, originalIndex) => ({
      ...item,
      text: getAgendaText(item),
      __originalIndex: originalIndex,
      __requestedPosition:
        Number.isInteger(item?.position) && item.position >= 0
          ? item.position
          : originalIndex,
    }))
    .filter((item) => item.text)
    .sort(
      (left, right) =>
        left.__requestedPosition - right.__requestedPosition ||
        left.__originalIndex - right.__originalIndex,
    )
    .map(({ __originalIndex, __requestedPosition, ...item }, position) => ({
      ...item,
      position,
    }));
};

export const sortAgendaItems = (items = []) => normalizeAgendaItems(items);
