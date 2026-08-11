export function heuristicContradictionCheck(textA, textB) {
  const signals = [];

  const dateRegex =
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}\b/gi;
  const datesA = (textA.match(dateRegex) || []).map((s) => s.toLowerCase());
  const datesB = (textB.match(dateRegex) || []).map((s) => s.toLowerCase());

  if (datesA.length === 1 && datesB.length === 1 && datesA[0] !== datesB[0]) {
    signals.push({ type: "date" });
  }

  const entityRegex = /(?<=\s)[A-Z][a-z]+/g;
  const entitiesA = textA.match(entityRegex) || [];
  const entitiesB = textB.match(entityRegex) || [];

  if (
    entitiesA.length === 1 &&
    entitiesB.length === 1 &&
    entitiesA[0] !== entitiesB[0]
  ) {
    signals.push({ type: "entity" });
  }

  const wordsA = new Set(textA.toLowerCase().split(/\s+/));
  const wordsB = new Set(textB.toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  const jaccard = union.size === 0 ? 0 : intersection.size / union.size;

  const isContradiction = signals.length > 0 && jaccard > 0.1;
  return {
    isContradiction,
    confidence: isContradiction ? 80 : 0,
    signals,
    explanation: isContradiction
      ? "Heuristic signals indicate a contradiction."
      : "No contradiction found.",
  };
}

export function sharesTopicVocabulary(textA, textB) {
  const wordsA = new Set(
    textA
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2),
  );
  const wordsB = new Set(
    textB
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2),
  );

  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let intersectionSize = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersectionSize++;
  }

  const unionSize = wordsA.size + wordsB.size - intersectionSize;
  return intersectionSize / unionSize > 0.1;
}
