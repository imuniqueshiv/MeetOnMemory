# AI-Powered Contradiction Detection & Conflict Resolution

Implements Issue #375. This document explains how the engine detects
contradictory memories in the knowledge graph, how conflicts are grouped
and scored, and how users resolve them.

## Why this exists

The knowledge graph stores "memories" as `Decision` and `ActionItem`
documents. As meetings accumulate, the same topic can get recorded with
genuinely different — not just differently-worded — values:

- "Project deadline is July 15." vs. "Project deadline is July 22."
- "Frontend owner is Alice." vs. "Frontend owner is Bob."
- "Database is PostgreSQL." vs. "Database migrated to MongoDB."

This is a different problem from the existing **Memory Consolidation
Engine** (`server/services/memoryConsolidationService.js`), which merges
*paraphrases of the same fact* ("I live in Delhi" / "My home city is
Delhi"). Contradiction Detection looks for *the same topic, different
asserted value* instead, and — because reasonable people can disagree
about which value is correct — it never auto-merges. It surfaces the
conflict for a human to resolve, and keeps every version intact.

## Pipeline

```
Decision / ActionItem records (active, non-superseded)
        │
        ▼
 ContradictionAnalyzer.isSameTopic()          — cheap pre-filter
   (embedding similarity in a "same topic, not
    a near-duplicate" band, or lexical overlap
    fallback when embeddings are missing)
        │  same topic?
        ▼
 utils/contradictionSignals.heuristicContradictionCheck()
   — deterministic, offline: differing dates, numbers,
     proper nouns (owners/entities), or negation mismatch
        │
        ▼ (if GEMINI_API_KEY is configured)
 GenerativeAIService.classifyContradiction()
   — LLM-based NLI-style classification:
     "contradiction" | "entailment" | "neutral",
     with a confidence score and a plain-English explanation
        │
        ▼
 ConflictAggregator.buildConflictClusters()
   — union-find groups transitively-linked conflicting
     pairs (A vs B, B vs C) into one review set
        │
        ▼
 ConflictStorage.storeConflictCluster()
   — persists/updates a ConflictSet document; re-scans
     update the existing open conflict instead of duplicating it
```

Two things are true regardless of whether an LLM is configured:

1. **The heuristic always runs.** It's the sole classifier when no
   `GEMINI_API_KEY` is set, and it's used as a sanity floor when the AI
   result and the heuristic strongly disagree (e.g. a noisy AI call can't
   single-handedly manufacture a conflict the heuristic saw zero signal
   for).
2. **An AI "entailment" verdict defers to Consolidation.** If the
   classifier decides two records are actually paraphrases of the same
   fact, Contradiction Detection backs off rather than raising a false
   conflict — that pair belongs to the Memory Consolidation Engine
   instead.

## Data model — `ConflictSet`

See `server/models/conflictModel.js`. Key fields:

| Field | Purpose |
|---|---|
| `memberIds` | The 2+ memories involved |
| `memberSnapshots` | Text/owner/status captured at detection time, so the record stays reviewable even if a member is later edited |
| `pairwiseConflicts` | Every pairwise contradiction that justified grouping these members together, with signals + explanation + confidence |
| `confidence` | Highest pairwise confidence in the set (0–100) |
| `explanation` | Human-readable summary shown in the resolution UI |
| `status` | `open` → `resolved` \| `dismissed` |
| `resolution` | What was decided and by whom (see below) |

Nothing is ever deleted. A `ConflictSet` is an audit record in its own
right, independent of what later happens to the underlying memories.

## Detection triggers

- **On-demand**: `POST /api/knowledge/conflicts/scan` (dry-run by
  default; pass `{ "dryRun": false }` to persist).
- **Background**: `services/conflictScanTrigger.js` listens for the
  `mom.generated` event (emitted once a meeting's decisions/action items
  have been extracted — see `knowledgeGraphService.processStructuredMoM`)
  and enqueues a BullMQ job (`conflict-scan-queue`, handled by
  `jobs/conflictScanJob.js`) so newly added memories are checked against
  the graph without blocking the request that created them. One job is
  in flight per organization at a time.

## Resolution workflow

`POST /api/knowledge/conflicts/:id/resolve` accepts one of three
resolution types:

- **`kept_member`** — one existing memory is correct. The chosen memory
  is left as-is; the other member(s) are marked `status: "superseded"`
  with `supersededByMemory` pointing at the winner — the same convention
  Memory Consolidation uses to deprioritize old records in retrieval —
  **but the losing memory's text is never rewritten**, since it wasn't a
  duplicate, just outdated.
- **`custom_value`** — neither existing memory is fully correct; the
  user supplies the true value as free text on the `ConflictSet` itself.
  No member record is mutated, since crowning either one canonical would
  misrepresent what was actually said in either meeting.
- **`dismissed`** — reviewed and judged not to be a real contradiction
  (e.g. sequential status updates that only look contradictory out of
  context). No member record is mutated.

Every resolution is written to `AuditLog` (`action: "conflict_resolved"`)
alongside the existing `memory_consolidation` / `conflict_scan` audit
entries, so an org's admins have one place to review all knowledge-graph
mutations.

## Permissions

Reuses the existing `knowledge` RBAC resource (`server/utils/
rbacPermissions.js`):

- `knowledge.view` — list/inspect conflicts (`owner`, `admin`,
  `moderator`, `member`, `guest`)
- `knowledge.resolve_conflicts` — run a scan or resolve a conflict
  (`owner`, `admin`, `moderator`) — the same set of roles allowed to run
  Memory Consolidation, since both mutate graph metadata in bulk.

## API summary

| Method | Path | Permission |
|---|---|---|
| `POST` | `/api/knowledge/conflicts/scan` | `resolve_conflicts` |
| `GET` | `/api/knowledge/conflicts` | `view` |
| `GET` | `/api/knowledge/conflicts/:id` | `view` |
| `POST` | `/api/knowledge/conflicts/:id/resolve` | `resolve_conflicts` |

## Tests

`server/tests/conflictDetectionService.test.js` covers:

- Heuristic signal detection (dates, entities, negation, unrelated text,
  paraphrase-only text producing no false positive)
- `detectContradiction`'s heuristic/AI blending and fallback behavior
- Cluster building (grouping + no-op on unrelated records)
- End-to-end detection (dry run vs. persisted, re-scan dedup)
- All three resolution types, plus rejecting an already-resolved
  conflict and an invalid `keptMemoryId`

## Follow-ups / out of scope for this change

- The resolution UI (`client/src/pages/ConflictResolution.jsx`) covers
  reviewing and resolving conflicts one at a time; bulk resolution and a
  dedicated "conflict inbox" notification are natural next steps.
- The AI classifier prompt asks for a single relation label per pair;
  richer NLI models could return partial/graded contradiction for finer
  confidence tuning.