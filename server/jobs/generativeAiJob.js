/**
 * Generative AI Job Processor
 * Handles AI-powered tasks like MoM generation, session cards, etc.
 */
export default async function generativeAiJob(job, app) {
  const { meetingId, transcript, date, title, userId } = job.data;

  console.log(
    `Processing AI job for meeting ${meetingId || "transcript-only"}`,
  );

  // Import services dynamically to avoid circular dependencies
  const { generateMoM } = await import("../services/GenerativeAIService.js");

  try {
    const result = await generateMoM({
      meetingId,
      transcript,
      date,
      title,
      userId,
    });

    return result;
  } catch (error) {
    console.error("Error in generative AI job:", error);
    throw error;
  }
}
