import Meeting from "../models/meetingModel.js";
import { calculateCosineSimilarity } from "./semanticSimilarityMatcher.js";

export const findDuplicates = async (organizationId) => {
  const meetings = await Meeting.find({ organization: organizationId }).sort({ date: -1 });
  const duplicates = [];
  
  for (let i = 0; i < meetings.length; i++) {
    for (let j = i + 1; j < meetings.length; j++) {
      const m1 = meetings[i];
      const m2 = meetings[j];
      
      // Check temporal proximity (same day)
      const date1 = new Date(m1.date).toISOString().split('T')[0];
      const date2 = new Date(m2.date).toISOString().split('T')[0];
      
      if (date1 === date2) {
        const similarity = calculateCosineSimilarity(m1.transcript, m2.transcript);
        if (similarity > 0.8) {
          duplicates.push({ primary: m1, duplicate: m2, similarityScore: similarity });
        }
      }
    }
  }
  
  return duplicates;
};
