import { aiResultsQueue } from "../services/queueService.js";
import { generateMoMDetailed } from "../services/GenerativeAIService.js";
import TranscriptChapter from "../models/transcriptChapterModel.js";

export default async function processAudioJob(job) {
  const { meetingId, transcript, date, title, customInstructions, userId } =
    job.data;

  console.log(
    `[processAudioJob] Generating MoM for meeting ${meetingId || "transcript-only"}...`,
  );

  const textToSummarize = (transcript || "").trim();
  if (!textToSummarize) {
    throw new Error("No transcript provided.");
  }

  // Fetch visual frames
  let visualFramesText = null;
  if (meetingId) {
    const tc = await TranscriptChapter.findOne({ meeting: meetingId });
    if (tc && tc.chapters && tc.chapters.length > 0) {
      const visualChapters = tc.chapters.filter(
        (c) => c.imageUrl || c.extractedText || c.summary,
      );
      if (visualChapters.length > 0) {
        visualFramesText = visualChapters
          .map(
            (c) =>
              `[${new Date(c.startTime).toLocaleTimeString()}] Slide Description: ${c.summary}\nExtracted Text: ${c.extractedText}`,
          )
          .join("\n\n");
      }
    }
  }

  // Generate MoM
  const { mom: generated, generation } = await generateMoMDetailed(
    textToSummarize,
    date,
    title,
    customInstructions,
    visualFramesText,
  );

  // Publish result back to the main server results queue
  if (aiResultsQueue && aiResultsQueue.isActive) {
    await aiResultsQueue.add("ai-mom-result-job", {
      meetingId,
      userId,
      transcript: textToSummarize,
      date,
      title,
      structuredMoM: generated,
      generation,
    });
    console.log(
      `[processAudioJob] Successfully enqueued result for meeting ${meetingId || "transcript-only"}`,
    );
  } else {
    console.warn(
      "⚠️ aiResultsQueue is not active; cannot publish MoM results.",
    );
  }

  return { success: true, meetingId };
}
