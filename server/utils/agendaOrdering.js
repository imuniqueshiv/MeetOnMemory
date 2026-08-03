const getAgendaText = (item) =>
  typeof item?.text === "string"
    ? item.text.trim()
    : typeof item?.title === "string"
      ? item.title.trim()
      : "";

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
