import api from "./apiClient";

/**
 * Fetch glossary terms
 * @param {Object} params { status, search }
 */
export const fetchTerms = async (params = {}) => {
  const { data } = await api.get("/glossary", { params });
  return data;
};

/**
 * Create a new glossary term
 * @param {Object} termData
 */
export const createTerm = async (termData) => {
  const { data } = await api.post("/glossary", termData);
  return data;
};

/**
 * Update an existing glossary term
 * @param {string} id
 * @param {Object} termData
 */
export const updateTerm = async (id, termData) => {
  const { data } = await api.put(`/glossary/${id}`, termData);
  return data;
};

/**
 * Delete a glossary term
 * @param {string} id
 */
export const deleteTerm = async (id) => {
  const { data } = await api.delete(`/glossary/${id}`);
  return data;
};

/**
 * Approve a pending term
 * @param {string} id
 */
export const approveTerm = async (id) => {
  const { data } = await api.post(`/glossary/${id}/approve`);
  return data;
};

const detectCache = new Map();

/**
 * Detect terms in a given text
 * @param {string} text
 */
export const detectTerms = async (text) => {
  if (!text) return [];

  // Create a simple hash/key (can just use the text itself if it's not huge, or a truncated version for safety)
  // Since text can be up to 15000 chars, let's just use it as key, JS Map can handle it fine for a single page session
  if (detectCache.has(text)) {
    return detectCache.get(text);
  }

  const { data } = await api.post("/glossary/detect", { text });

  detectCache.set(text, data);
  // Optional: keep cache size bounded if needed, but for a single meeting session it's fine.
  if (detectCache.size > 50) {
    const firstKey = detectCache.keys().next().value;
    detectCache.delete(firstKey);
  }

  return data;
};

/**
 * Helper to check if cache already has the text (for synchronous checking)
 */
export const getCachedDetection = (text) => {
  return detectCache.get(text);
};

/**
 * Extract terms from a meeting using AI
 * @param {string} meetingId
 */
export const extractTerms = async (meetingId) => {
  const { data } = await api.post("/glossary/extract", { meetingId });
  return data;
};
