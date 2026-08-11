// ==============================================
// 📘 conflictScanJob.js
// BullMQ job handler for background contradiction scanning. Enqueued
// after a meeting's structured MoM (and therefore its decisions/action
// items) is generated, so newly added memories get checked against the
// existing knowledge graph without blocking the request that created
// them (see server.js's "mom.generated" listener).
// ==============================================

import { detectConflicts } from "./conflictDetectionService.js";

/**
 * @param {import("bullmq").Job} job - job.data: { organization }
 */
export default async function conflictScanJob(job) {
  const { organization } = job.data || {};

  const report = await detectConflicts({
    organization: organization || null,
    dryRun: false,
    useAI: true,
  });

  console.log(
    `🔎 Conflict scan complete for org ${organization || "(none)"}: ` +
      `${report.totalConflictsFound} conflict set(s) found/updated`,
  );

  return report;
}
