# Memory Graph Snapshot & Time-Travel

Implements issue [#374](https://github.com/imuniqueshiv/MeetOnMemory/issues/374).

## Overview

MeetOnMemory's knowledge graph (`server/graph/graphIndex.js`) is rebuilt
on-demand from live `Decision` and `ActionItem` documents. That's fine for
retrieval, but it means there's no way to see how the graph looked last
week, or exactly what changed after a given meeting.

This feature adds a **snapshot engine** that captures point-in-time copies
of the graph and lets callers browse history and diff any two points.

## Data model — `GraphSnapshot`

`server/models/graphSnapshotModel.js`

Each snapshot is a **self-contained** copy of the graph at that moment:
a flat list of nodes (`key`, `type`, `refId`, `text`, `owner`, `status`,
`sourceMeetingId`, `createdAt`) and edges (`source`, `target`, `weight`),
plus metadata (counts) and trigger provenance (`trigger`, `sourceMeetingId`,
`triggeredBy`).

Snapshots are intentionally **not** references back to live `Decision`/
`ActionItem` documents. If they were, editing or deleting a decision today
would silently rewrite history. Storing a flat copy means a snapshot from
three months ago still renders exactly as it did then, even after the
underlying records are edited, merged by consolidation, or deleted.

## Storage strategy: hash-based deduplication

Every capture is content-hashed (SHA-256 over the sorted node/edge list).
Before writing, the engine compares the new hash against the organization's
*most recent* snapshot. If they match, nothing is written — the trigger
fired, but the graph didn't actually change, so there's nothing worth
keeping a duplicate copy of.

This was chosen over incremental/delta storage (storing only the diff from
the previous snapshot and replaying deltas to reconstruct a point in time)
because:

- Reads stay O(1) — fetching snapshot N never requires replaying N-1 deltas.
- It's simple to reason about and test.
- At this project's scale (per-organization decisions + action items, not a
  firehose graph), full copies are cheap; the dominant storage cost is
  redundant *identical* captures, which hash-dedup eliminates directly.

If graphs grow large enough that this stops being true, the next step is
compressing `nodes`/`edges` (e.g. gzip the JSON blob) rather than
delta-encoding, since it preserves O(1) reads.

## Triggers

Snapshots are captured automatically, non-fatally (wrapped the same way as
the rest of the knowledge-graph pipeline — a failure here never fails the
meeting-processing flow):

| Trigger | Where | When |
|---|---|---|
| `meeting_processed` | `MeetingService._runKnowledgeGraph` | After a meeting's decisions/action items are merged into the graph |
| `consolidation` | `consolidationController.runConsolidation` | After a non-dry-run memory consolidation (bulk graph mutation) |
| `manual` | `POST /api/knowledge/graph/snapshots` | User-triggered (e.g. "before I do this bulk edit") |
| `scheduled` | *(reserved)* | For a future cron-based periodic capture, if automatic-only triggers prove too sparse |

## Diffing

`diffSnapshots(fromId, toId, organization)` in
`server/services/graphSnapshotService.js` computes:

- **Nodes**: added, removed, modified (text/owner/status changes on a node
  present in both).
- **Edges**: added, removed, modified (weight changes on an edge present in
  both).

Diffs are computed **on demand** by loading the two snapshots and comparing
maps keyed by node/edge identity — not precomputed and cached per pair.
This keeps writes cheap (one hash comparison, no O(n²) pairwise diff
bookkeeping) and the comparison itself is O(nodes + edges), which is cheap
enough to run per-request at this scale. Any two snapshots can be compared,
not just adjacent ones, so a user can trace evolution across an arbitrary
range (e.g. "how has this decision cluster evolved since Q1").

## API

All routes are under `/api/knowledge/graph/snapshots`, organization-scoped
via the existing `requireOrgMembership` + `requirePermission("knowledge", …)`
middleware:

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/graph/snapshots?limit=&before=` | `knowledge:view` | Timeline listing (metadata only) |
| GET | `/graph/snapshots/:id` | `knowledge:view` | Full snapshot (nodes + edges) |
| GET | `/graph/snapshots/:id/export` | `knowledge:view` | Same payload, `Content-Disposition: attachment` for download/audit |
| GET | `/graph/snapshots/diff?from=&to=` | `knowledge:view` | Node/edge diff between two snapshots |
| POST | `/graph/snapshots` (`{ force? }`) | `knowledge:snapshot` | Manually trigger a capture |

## Performance / isolation from the live graph

- Snapshot capture reuses `buildGraph()`, the same query already used by
  retrieval — no new hot-path query pattern.
- Snapshot reads/writes hit their own `GraphSnapshot` collection, indexed on
  `{ organization, createdAt }` and `{ organization, contentHash }`, so they
  never touch `Decision`/`ActionItem` query performance.
- Capture is fire-and-forget from the caller's perspective (wrapped in
  non-fatal try/catch), so a slow or failed snapshot write never blocks or
  fails meeting processing, consolidation, or the user-facing request.

## Tests

`server/tests/graphSnapshotService.test.js` covers: capture correctness
(node/edge counts match the live graph), dedup skipping, re-capture once the
graph changes, `force`, organization scoping, listing/pagination shape, and
diff correctness (added/removed/modified nodes and edges).

## Follow-ups (not in this change)

- **Timeline / diff visualization UI**: the API returns everything a
  frontend needs (node/edge lists, diff summaries), but no client component
  exists yet. A follow-up should add a timeline view (list snapshots,
  `metadata.nodeCount`/`edgeCount` deltas) and a graph diff renderer
  (color-code added/removed/modified nodes). No graph-visualization library
  is currently a client dependency; `recharts` (already installed) can drive
  the timeline sparkline, but rendering the graph itself will need a new
  dependency (e.g. `react-force-graph` or `d3-force`) — worth a short
  spike before committing to one.
- **Restore previous graph versions**: explicitly called out as optional in
  the issue. Not implemented here, since "restoring" a snapshot means
  reverse-syncing flat snapshot rows back into live `Decision`/`ActionItem`
  documents (recreating deleted ones, reverting edited ones), which is a
  meaningfully different and riskier operation than the read-oriented
  snapshot/diff/export flow this change covers.
- **Scheduled trigger**: the `trigger` enum reserves `"scheduled"` for a
  cron-based periodic capture; not wired up since `meeting_processed` +
  `consolidation` already cover the main "graph changed" moments.
