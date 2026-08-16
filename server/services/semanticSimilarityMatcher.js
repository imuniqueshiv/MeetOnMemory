export const calculateCosineSimilarity = (textA, textB) => {
  if (!textA || !textB) return 0;
  
  const getTerms = (text) => {
    const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
    const termFreq = {};
    for (const w of words) {
      termFreq[w] = (termFreq[w] || 0) + 1;
    }
    return termFreq;
  };
  
  const termsA = getTerms(textA);
  const termsB = getTerms(textB);
  
  const uniqueTerms = new Set([...Object.keys(termsA), ...Object.keys(termsB)]);
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (const term of uniqueTerms) {
    const valA = termsA[term] || 0;
    const valB = termsB[term] || 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};
