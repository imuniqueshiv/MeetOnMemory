import { recalculateAllImportanceScores } from "../services/importanceScoringService.js";

export default async function recalculateImportanceJob(job) {
  const { organization } = job.data;
  console.log(
    `🤖 Starting background importance score recalculation for organization ${organization}...`,
  );
  try {
    const results = await recalculateAllImportanceScores({ organization });
    console.log(
      `✅ Completed background importance score recalculation:`,
      results,
    );
    return results;
  } catch (error) {
    console.error(
      `❌ Background importance score recalculation failed:`,
      error.message,
    );
    throw error;
  }
}
