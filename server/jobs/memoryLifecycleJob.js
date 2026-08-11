import { runLifecycleSweep } from "../services/memoryLifecycleService.js";

export default async function memoryLifecycleJob(job) {
  const { organization, policyOverrides } = job.data || {};
  console.log(
    `🗄️ Starting background memory lifecycle sweep for organization ${organization}...`,
  );
  try {
    const summary = await runLifecycleSweep({ organization, policyOverrides });
    console.log(`✅ Completed background memory lifecycle sweep:`, summary);
    return summary;
  } catch (error) {
    console.error(
      `❌ Background memory lifecycle sweep failed:`,
      error.message,
    );
    throw error;
  }
}
