// ==============================================
// 📘 conflictScanTrigger.js
// Side-effect module: subscribes to the "mom.generated" event (emitted
// once a meeting's decisions/action items have been extracted into the
// knowledge graph — see knowledgeGraphService.processStructuredMoM) and
// enqueues a background contradiction scan for that meeting's
// organization, so new memories are checked against the existing graph
// without blocking the request that created them.
//
// Mirrors slackService.js's "register a listener on import" pattern —
// imported once, for its side effect, from server.js.
// ==============================================

import eventBus from "./eventBus.js";
import { conflictScanQueue } from "./queueService.js";

eventBus.on("mom.generated", async (meeting) => {
  try {
    const organization = meeting?.organization
      ? meeting.organization.toString()
      : null;

    // One in-flight/queued scan per organization at a time — a burst of
    // meetings finishing MoM generation back-to-back shouldn't spawn a
    // pile of redundant scans of the same knowledge graph.
    //
    // Issue #975: the retention overrides that used to be spelled out here are
    // now part of the queue's shared defaults (see queueRegistry.js), which
    // also supply the `attempts`/`backoff` this call was missing — previously a
    // single transient failure discarded the scan outright.
    await conflictScanQueue.add(
      "scan",
      { organization },
      { jobId: `conflict-scan-${organization || "global"}` },
    );
  } catch (err) {
    console.error("⚠️ Failed to enqueue conflict scan:", err.message);
  }
});

export default eventBus;
