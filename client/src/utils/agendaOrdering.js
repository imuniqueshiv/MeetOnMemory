export const normalizeAgendaItems = (items = []) =>
  [...items].map((item, position) => ({ ...item, position }));

export const moveAgendaItem = (items, fromIndex, toIndex) => {
  if (
    !Array.isArray(items) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return normalizeAgendaItems(items || []);
  }

  const reordered = [...items];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return normalizeAgendaItems(reordered);
};
