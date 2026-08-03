import GlossaryTerm from "../models/glossaryTermModel.js";
import { generateText } from "./GenerativeAIService.js";
import Meeting from "../models/meetingModel.js";

class GlossaryService {
  /**
   * Detects known glossary terms in a given text string.
   */
  async detectTerms(text, orgId) {
    if (!text || !orgId) return [];

    // Fetch all approved terms for the organization
    const terms = await GlossaryTerm.find({
      organization: orgId,
      approvalStatus: "approved",
    });

    if (!terms.length) return [];

    const matches = [];

    terms.forEach((termObj) => {
      // Build a list of phrases to search for: the main term + any aliases
      const phrases = [termObj.term, ...termObj.aliases].filter(Boolean);

      phrases.forEach((phrase) => {
        // Escape special characters for regex
        const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Use word boundaries for exact match
        const regex = new RegExp(`\\b(${escapedPhrase})\\b`, "gi");

        let match;
        while ((match = regex.exec(text)) !== null) {
          matches.push({
            termId: termObj._id,
            matchedText: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            definition: termObj.definition,
            aliases: termObj.aliases,
            category: termObj.category,
          });
        }
      });
    });

    // Sort by start index
    return matches.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Scans a meeting transcript using AI to suggest new glossary terms.
   */
  async aiExtractTerms(meetingId, orgId) {
    // 1. Fetch meeting and transcript
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) throw new Error("Meeting not found");

    const transcriptText = meeting.transcript || "";
    if (!transcriptText) throw new Error("No transcript found for meeting");

    // 2. Fetch existing terms to avoid duplicates
    const existingTerms = await GlossaryTerm.find({ organization: orgId });
    const knownPhrases = existingTerms.flatMap((t) => [
      t.term.toLowerCase(),
      ...(t.aliases || []).map((a) => a.toLowerCase()),
    ]);

    // 3. Ask AI to extract unknown jargon
    const prompt = `
You are an AI assistant analyzing a meeting transcript.
Identify any domain-specific jargon, acronyms, or technical terms used in the transcript that are NOT in the following known list:
${JSON.stringify(knownPhrases)}

For each identified term, provide a short definition inferred from context or general knowledge.
Return ONLY a valid JSON array matching this structure (no markdown formatting):
[
  {
    "term": "The Jargon or Acronym",
    "definition": "Suggested definition based on context",
    "category": "Suggested category e.g., 'Engineering', 'Sales'"
  }
]

Transcript:
${transcriptText.substring(0, 15000)}
`;

    let extractedData = [];
    try {
      const outputText = await generateText(prompt, "Glossary term extraction");
      const cleanJson = outputText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      extractedData = JSON.parse(cleanJson);
    } catch (err) {
      console.error("AI extraction failed", err);
      throw new Error("Failed to extract terms using AI");
    }

    if (!Array.isArray(extractedData)) {
      extractedData = [];
    }

    // 4. Filter and save as pending suggestions
    const suggestions = [];
    for (const item of extractedData) {
      if (!item.term || !item.definition) continue;

      // Double check it's not already in DB
      if (knownPhrases.includes(item.term.toLowerCase())) continue;

      // Use findOneAndUpdate with upsert to prevent race conditions
      // This will only insert if a term with the same name doesn't exist for this org
      const updatedOrInsertedTerm = await GlossaryTerm.findOneAndUpdate(
        {
          organization: orgId,
          term: { $regex: new RegExp(`^${item.term}$`, "i") },
        },
        {
          $setOnInsert: {
            organization: orgId,
            term: item.term,
            definition: item.definition,
            category: item.category || "General",
            isAutoSuggested: true,
            approvalStatus: "pending",
          },
        },
        { new: true, upsert: true },
      );

      // Only add to suggestions if it was newly created (or if it's currently pending, we could include it,
      // but to be safe we'll just include it if we upserted it successfully)
      // If we want to strictly only return new suggestions, we might need rawResult, but this is fine.
      suggestions.push(updatedOrInsertedTerm);
      // add to known phrases to prevent duplicates in the same run
      knownPhrases.push(item.term.toLowerCase());
    }

    return suggestions;
  }
}

export default new GlossaryService();
