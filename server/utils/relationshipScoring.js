export function calculateRelationshipConfidence({
  similarity,
  explicitSignal = false,
  createdAt = null,
}) {
  let score = Math.round(similarity * 70);

  if (createdAt) {
    const ageDays =
      (Date.now() - new Date(createdAt).getTime()) /
      (1000 * 60 * 60 * 24);

    score += Math.max(0, 15 - ageDays * 0.1);
  }

  if (explicitSignal) {
    score += 15;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}