export const mergeStructuredMoM = (primaryMoM, secondaryMoM) => {
  if (!primaryMoM) return secondaryMoM;
  if (!secondaryMoM) return primaryMoM;
  
  const mergeArrays = (arr1, arr2) => {
    return [...new Set([...(arr1 || []), ...(arr2 || [])])];
  };

  const decisions = mergeArrays(primaryMoM.decisions, secondaryMoM.decisions);
  const action_items = mergeArrays(primaryMoM.action_items, secondaryMoM.action_items);
  
  // attendees could be objects, just basic string dedup if they are strings, otherwise keep all
  const attendees = [...(primaryMoM.attendees || []), ...(secondaryMoM.attendees || [])];
  
  return {
    ...primaryMoM,
    decisions,
    action_items,
    attendees
  };
};

export const mergeTranscripts = (primaryText, secondaryText) => {
  if (!primaryText) return secondaryText || "";
  if (!secondaryText) return primaryText || "";
  // Simple concatenation for now; real alignment would be timestamps based.
  return primaryText + "\n\n[Merged Content]:\n" + secondaryText;
};
