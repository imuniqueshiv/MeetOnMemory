import GlossaryTerm from "../models/glossaryTermModel.js";
import { generateText } from "./GenerativeAIService.js";
import Meeting from "../models/meetingModel.js";
import {
  caseInsensitiveEquals,
  wordBoundaryRegExp,
} from "../utils/regexUtils.js";
import { ForbiddenError, NotFoundError } from "../utils/errors.js";

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
        // This site already escaped correctly; it now shares the helper so
        // there is one definition of "match this phrase literally, on word
        // boundaries" rather than several (Issue #1157). The helper also
        // handles phrases that start or end with a non-word character — `\b`
        // before `#` can never match, so terms like `#eng` used to be found
        // zero times while the caller reported success.
        const regex = wordBoundaryRegExp(phrase, "gi");

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
    if (!meeting) throw new NotFoundError("Meeting not found");

    // The meeting must belong to the caller's organization (Issue #1273).
    //
    // `orgId` was previously used only to scope the *existing terms* lookup and
    // to stamp the terms this run creates — it was never compared against the
    // meeting. So `POST /api/glossary/extract` with any meeting id ran the
    // extraction prompt over another organization's transcript and persisted
    // the resulting terms and definitions into the caller's glossary, where
    // `GET /api/glossary` then served them back.
    //
    // `topicExtractionService.extractTopics` already performs exactly this
    // check on the same model; this path simply omitted it.
    if (
      !meeting.organization ||
      meeting.organization.toString() !== orgId.toString()
    ) {
      throw new ForbiddenError("Unauthorized access to meeting");
    }

    const transcriptText = meeting.transcript || "";
    if (!transcriptText)
      throw new NotFoundError("No transcript found for meeting");

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
      //
      // The filter is a collated equality match rather than `^term$` with the
      // `i` flag (Issue #1157). `item.term` comes straight out of the model's
      // JSON, so it is the least trustworthy input in the file — a returned
      // term of `.*` would have matched an arbitrary existing term and
      // upserted onto it, and one containing an unbalanced bracket would have
      // thrown a `SyntaxError` that aborted the whole extraction run.
      const { filter: termFilter, collation } = caseInsensitiveEquals(
        "term",
        item.term,
      );
      const updatedOrInsertedTerm = await GlossaryTerm.findOneAndUpdate(
        {
          organization: orgId,
          ...termFilter,
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
        { new: true, upsert: true, collation },
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
