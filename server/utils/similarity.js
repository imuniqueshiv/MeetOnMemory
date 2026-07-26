// ==============================================
// similarity.js
// Shared vector-similarity helpers used by both the
// knowledge-graph relationship builder and the hybrid
// retrieval pipeline. Extracted so there is a single
// source of truth for cosine similarity.
// ==============================================

/**
 * Cosine similarity between two equal-length numeric vectors.
 * Returns 0 for missing/empty/mismatched-length vectors instead of throwing,
 * since embeddings are sometimes absent for legacy records.
 */
export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default cosineSimilarity;
