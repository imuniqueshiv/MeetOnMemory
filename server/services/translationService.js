import TranslationCache from "../models/translationCacheModel.js";
import Transcript from "../models/transcriptModel.js";
import Meeting from "../models/meetingModel.js";
import { generateText, parseJsonOutput } from "./GenerativeAIService.js";
import { estimateTokens } from "../utils/aiResilience.js";

const SUPPORTED_LANGUAGES = [
  "Spanish",
  "French",
  "German",
  "Mandarin Chinese",
  "Japanese",
  "Korean",
  "Arabic",
  "Russian",
  "Portuguese",
  "Italian",
  "Dutch",
  "Hindi",
  "Turkish",
  "Vietnamese",
  "Polish",
];

export const getSupportedLanguages = () => SUPPORTED_LANGUAGES;

const buildTranslationPrompt = (content, sourceType, targetLanguage) => {
  if (sourceType === "transcript") {
    return `
You are an expert translator. Translate the following meeting transcript segments into ${targetLanguage}.
CRITICAL INSTRUCTIONS:
- Return ONLY a valid JSON array of objects.
- Preserve the exact JSON structure: [{"text": "...", "speaker": "...", "startTime": 12.3, "endTime": 15.6}].
- Translate ONLY the "text" field.
- DO NOT translate or modify "speaker", "startTime", or "endTime" fields.
- Do not include markdown, code blocks, or commentary.

Transcript segments to translate:
${JSON.stringify(content)}
`;
  } else if (sourceType === "summary") {
    return `
You are an expert translator. Translate the following meeting summary into ${targetLanguage}.
CRITICAL INSTRUCTIONS:
- Translate the text accurately and professionally.
- Return ONLY the translated text.
- Do not include markdown, code blocks, or commentary.

Summary to translate:
${content}
`;
  } else if (sourceType === "action_items") {
    return `
You are an expert translator. Translate the following meeting action items into ${targetLanguage}.
CRITICAL INSTRUCTIONS:
- Return ONLY a valid JSON array of objects.
- Preserve the exact JSON structure: [{"task": "...", "owner": "...", "due_date": "...", "status": "..."}].
- Translate ONLY the values of the fields, keeping the keys ("task", "owner", "due_date", "status") exactly the same in English.
- Do not include markdown, code blocks, or commentary.

Action items to translate:
${JSON.stringify(content)}
`;
  }
};

export const translateContent = async (
  meetingId,
  sourceType,
  targetLanguage,
) => {
  // Check cache
  const cached = await TranslationCache.findOne({
    meeting: meetingId,
    sourceType,
    targetLanguage,
  });

  if (cached) {
    return cached.translatedContent;
  }

  let translatedContent;
  let sourceId;
  let sourceModel;

  if (sourceType === "transcript") {
    const transcript = await Transcript.findOne({ meeting: meetingId });
    if (
      !transcript ||
      !transcript.segments ||
      transcript.segments.length === 0
    ) {
      throw new Error("Transcript not found or empty");
    }
    sourceId = transcript._id;
    sourceModel = "Transcript";

    const CHUNK_SIZE = 50;
    const translatedSegments = [];

    for (let i = 0; i < transcript.segments.length; i += CHUNK_SIZE) {
      const segmentBatch = transcript.segments
        .slice(i, i + CHUNK_SIZE)
        .map((s) => ({
          text: s.text,
          speaker: s.speaker,
          startTime: s.startTime,
          endTime: s.endTime,
        }));

      const prompt = buildTranslationPrompt(
        segmentBatch,
        "transcript",
        targetLanguage,
      );
      const outputText = await generateText(
        prompt,
        `Translate transcript batch ${i / CHUNK_SIZE + 1}`,
      );
      const parsedBatch = parseJsonOutput(outputText);

      if (Array.isArray(parsedBatch)) {
        const validatedBatch = parsedBatch.map((translated, index) => {
          const original = segmentBatch[index] || {};
          return {
            ...original,
            text: translated.text || original.text,
            speaker: original.speaker,
            startTime: original.startTime,
            endTime: original.endTime,
          };
        });
        translatedSegments.push(...validatedBatch);
      } else {
        console.error(
          "Failed to parse translated transcript batch:",
          outputText,
        );
        // Fallback: keep original text for this batch if translation fails
        translatedSegments.push(...segmentBatch);
      }
    }
    translatedContent = translatedSegments;
  } else if (sourceType === "summary") {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting || (!meeting.summary && !meeting.structuredMoM?.summary)) {
      throw new Error("Summary not found");
    }
    sourceId = meeting._id;
    sourceModel = "Meeting";

    const textToTranslate =
      meeting.summary || meeting.structuredMoM?.summary || "";
    const prompt = buildTranslationPrompt(
      textToTranslate,
      "summary",
      targetLanguage,
    );
    const outputText = await generateText(prompt, "Translate summary");

    // Remove potential markdown formatting from text response
    translatedContent = outputText
      .replace(/^\`\`\`(json|text)?/, "")
      .replace(/\`\`\`$/, "")
      .trim();
  } else if (sourceType === "action_items") {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting || !meeting.structuredMoM?.action_items) {
      throw new Error("Action items not found");
    }
    sourceId = meeting._id;
    sourceModel = "Meeting";

    const prompt = buildTranslationPrompt(
      meeting.structuredMoM.action_items,
      "action_items",
      targetLanguage,
    );
    const outputText = await generateText(prompt, "Translate action items");
    const parsed = parseJsonOutput(outputText);

    translatedContent = Array.isArray(parsed)
      ? parsed
      : meeting.structuredMoM.action_items;
  } else {
    throw new Error("Invalid sourceType");
  }

  // Save to cache
  await TranslationCache.create({
    sourceType,
    sourceId,
    sourceModel,
    meeting: meetingId,
    targetLanguage,
    translatedContent,
    tokenCount: estimateTokens(JSON.stringify(translatedContent)),
  });

  return translatedContent;
};
