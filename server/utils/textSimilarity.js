// ==============================================
// 📘 textSimilarity.js
// Lightweight, dependency-free lexical similarity helpers.
//
// These complement embedding-based cosine similarity
// (see utils/embeddingUtils.js + services/knowledgeGraphService.js).
// Embeddings can be missing (model not loaded / empty text) or can miss
// short, near-identical paraphrases with heavy word overlap. Lexical
// scoring acts as a cheap, deterministic fallback/booster signal for the
// Memory Consolidation Engine's duplicate detection.
// ==============================================

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "am",
  "be",
  "been",
  "being",
  "to",
  "of",
  "in",
  "on",
  "at",
  "for",
  "and",
  "or",
  "but",
  "with",
  "my",
  "i",
  "we",
  "our",
  "currently",
]);

/**
 * Normalize text for comparison: lowercase, strip punctuation, collapse
 * whitespace. Deliberately conservative — we don't stem, to avoid merging
 * unrelated concepts that happen to share a root word.
 */
export function normalizeText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenizes normalized text into a set of significant (non-stopword) words.
 */
export function tokenize(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return normalized.split(" ").filter((w) => w && !STOPWORDS.has(w));
}

/**
 * Jaccard similarity between two token sets: |A ∩ B| / |A ∪ B|.
 * Good for catching reworded sentences that share most of their
 * meaningful vocabulary (e.g. "I live in Delhi" vs "My home city is Delhi").
 */
export function jaccardSimilarity(textA, textB) {
  const tokensA = new Set(tokenize(textA));
  const tokensB = new Set(tokenize(textB));

  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  let previousRow = new Array(lenB + 1);
  for (let j = 0; j <= lenB; j++) previousRow[j] = j;

  for (let i = 1; i <= lenA; i++) {
    const currentRow = [i];
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow[j] = Math.min(
        previousRow[j] + 1, // deletion
        currentRow[j - 1] + 1, // insertion
        previousRow[j - 1] + cost, // substitution
      );
    }
    previousRow = currentRow;
  }

  return previousRow[lenB];
}

/**
 * Normalized Levenshtein similarity in [0, 1], where 1 means identical.
 * Skipped (returns null) for long strings where character-level distance
 * stops being a meaningful signal and is expensive to compute.
 */
export function levenshteinSimilarity(textA, textB, { maxLength = 300 } = {}) {
  const a = normalizeText(textA);
  const b = normalizeText(textB);
  if (a.length > maxLength || b.length > maxLength) return null;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Combined lexical/paraphrase similarity score in [0, 1].
 * Blends token-overlap (robust to reordering) with edit-distance
 * (robust to small wording changes) so both "reworded" and "reworded
 * slightly" paraphrases score highly.
 */
export function computeTextSimilarity(textA, textB) {
  const jaccard = jaccardSimilarity(textA, textB);
  const levenshtein = levenshteinSimilarity(textA, textB);

  if (levenshtein === null) return jaccard;
  return jaccard * 0.6 + levenshtein * 0.4;
}
