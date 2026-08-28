import Meeting from "../models/meetingModel.js";
import Transcript from "../models/transcriptModel.js";
import TranscriptChapter from "../models/transcriptChapterModel.js";
import { generateText, parseJsonOutput } from "./GenerativeAIService.js";
import { ForbiddenError, NotFoundError } from "../utils/errors.js";

/**
 * Extracts chapters from a meeting's transcript using Generative AI.
 */
export const extractChapters = async (meetingId, userOrgId) => {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new NotFoundError("Meeting not found");

  if (meeting.organization.toString() !== userOrgId.toString()) {
    throw new ForbiddenError("Unauthorized access to meeting");
  }

  const transcript = await Transcript.findOne({ meeting: meetingId });
  if (!transcript || !transcript.segments || transcript.segments.length === 0) {
    throw new NotFoundError("No transcript found for meeting");
  }

  if (transcript.isEncrypted) {
    throw new Error("Cannot extract chapters from an E2E encrypted transcript");
  }

  // To help the AI map back to timestamps, include them in the prompt context
  const transcriptTextWithTimes = transcript.segments
    .map(
      (s) =>
        `[${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s] ${s.speaker || "Unknown"}: ${s.text}`,
    )
    .join("\n");

  const prompt = `
You are an AI tasked with analyzing a meeting transcript to extract logical chapters or topic segments based on shifts in conversation.
Divide the meeting into chronological chapters that cover the entire duration. There should be no gaps.
For each chapter, provide:
- title: A concise, descriptive title for the chapter.
- startTime: The start time (in seconds) of this chapter.
- endTime: The end time (in seconds) of this chapter.
- summary: A brief 1-2 sentence overview of the discussion in this chapter.
- keyQuotes: 1-3 key quotes from the chapter (exact quotes if possible).
- sentiment: The dominant sentiment of the chapter. Must be exactly one of: "POSITIVE", "NEUTRAL", or "NEGATIVE".

Transcript:
${transcriptTextWithTimes}

Return ONLY a JSON array matching this format exactly:
[
  {
    "title": "Introduction and Agenda",
    "startTime": 0,
    "endTime": 120.5,
    "summary": "The team discusses the agenda and does quick introductions.",
    "keyQuotes": ["Let's get started with the agenda."],
    "sentiment": "NEUTRAL"
  }
]
`;

  const outputText = await generateText(
    prompt,
    "Transcript Chapters Extraction",
  );
  const extractedChapters = parseJsonOutput(outputText);

  if (!extractedChapters || !Array.isArray(extractedChapters)) {
    throw new Error("Failed to parse extracted chapters from AI");
  }

  // Ensure times are valid numbers and sentiment is mapped
  const validSentiments = ["POSITIVE", "NEUTRAL", "NEGATIVE"];
  const chaptersToSave = extractedChapters.map((ch) => ({
    title: ch.title || "Untitled Chapter",
    startTime: Number(ch.startTime) || 0,
    endTime: Number(ch.endTime) || 0,
    summary: ch.summary || "",
    keyQuotes: ch.keyQuotes || [],
    sentiment: validSentiments.includes(ch.sentiment)
      ? ch.sentiment
      : "NEUTRAL",
    isManual: false,
  }));

  // Save to database (replace existing if any) atomically
  const transcriptChapter = await TranscriptChapter.findOneAndUpdate(
    { meeting: meetingId },
    {
      $set: {
        organization: meeting.organization,
        chapters: chaptersToSave,
      },
    },
    { upsert: true, new: true },
  );

  return transcriptChapter;
};
