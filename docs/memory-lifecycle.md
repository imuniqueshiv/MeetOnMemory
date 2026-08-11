# Memory Lifecycle Management

Implements Issue #377. This document explains how memories move through
lifecycle states over time, how retention policies are configured, and how
archived memories come back when they're needed again.

## Why this exists

The knowledge graph stores "memories" as `Decision` and `ActionItem`
documents. As meetings accumulate over months, many memories stop being
useful day-to-day without ever becoming _wrong_ — they're just old. Without
some notion of lifecycle, every memory (an important architectural decision
from last quarter, or a one-off follow-up nobody ever checks again) is
retrieved and weighted identically, which both hurts retrieval quality and
lets storage grow unbounded.

This is deliberately a separate concern from **Dynamic Memory Importance
Scoring** (`server/services/importanceScoringService.js`, Issue #269).
Importance scoring answers "how relevant is this memory _right now_, among
the ones being shown"; lifecycle management answers "should this memory be
shown by default at all". The lifecycle engine reuses the importance score
as one of its signals (see below) rather than duplicating that logic.

## Lifecycle states

```
 active ──(inactive ≥ dormantAfterDays)──▶ dormant
   ▲                                          │
   │                              (inactive ≥ archivedAfterDays,
   │                               importanceScore below the
   │                               protection threshold)
   │                                          ▼
   └──────────(referenced again)──────── archived
   ▲                                          │
   │                              (inactive ≥ expiredAfterDays
   │                               while still archived)
   │                                          ▼
   └──────────(manually restored)────────  expired
```

- **active** — default state. Shown in normal listings and search.
- **dormant** — inactive for a while; still shown, but flagged as
  low-usage. A soft signal, not a retrieval filter.
- **archived** — excluded from default `GET` listings
  (`/api/knowledge/decisions`, `/api/knowledge/action-items`), but still
  fully searchable/restorable — nothing is hidden from the underlying
  collection, just from the default view.
- **expired** — eligible for permanent deletion on a future sweep. Nothing
  is ever deleted unless `LIFECYCLE_HARD_DELETE_EXPIRED=true` is explicitly
  set (off by default), and only once a memory has already sat in
  `expired` through one full sweep.

A memory whose `importanceScore` is at or above
`LIFECYCLE_PROTECT_IMPORTANCE` (default 70) is never auto-archived or
auto-expired, no matter how long it's been inactive — it can still be
flagged `dormant` as a soft signal, but stays in normal retrieval.

## Configuring retention policy

All thresholds live in `server/config/lifecyclePolicy.js` and are
overridable via environment variables, so retention rules can change
without a code deploy:

| Env var                         | Default          | Meaning                                                     |
| ------------------------------- | ---------------- | ----------------------------------------------------------- |
| `LIFECYCLE_DORMANT_AFTER_DAYS`  | 30               | Days of inactivity before `active` → `dormant`              |
| `LIFECYCLE_ARCHIVED_AFTER_DAYS` | 90               | Days of inactivity before → `archived`                      |
| `LIFECYCLE_EXPIRED_AFTER_DAYS`  | 365              | Days an _archived_ memory sits untouched before → `expired` |
| `LIFECYCLE_PROTECT_IMPORTANCE`  | 70               | Importance score at/above which archival/expiry is skipped  |
| `LIFECYCLE_HARD_DELETE_EXPIRED` | `false`          | Whether the sweep may permanently delete `expired` memories |
| `LIFECYCLE_SWEEP_INTERVAL_MS`   | 86400000 (1 day) | How often the automatic sweep runs                          |

"Inactive" is measured from `lastAccessedAt`, falling back to `createdAt`
for memories that have never been explicitly accessed.

## How memories transition

`server/services/memoryLifecycleService.js` exposes:

- `evaluateLifecycleState(memory, policy)` — pure function, no DB access.
  Given a plain data view of a memory, returns the state it _should_ be in.
  This is what's unit-tested in `tests/memoryLifecycleService.test.js`.
- `transitionLifecycleState(document, toState, { reason, triggeredBy })` —
  persists a transition and appends an entry to the document's
  `lifecycleHistory` array (mirrors the `mergedFrom` pattern used by the
  Memory Consolidation Engine), so every transition is auditable without a
  separate lookup.
- `restoreMemory(type, id, options)` — always brings a memory back to
  `active`, regardless of its current state (including `expired`, as long
  as the document hasn't been hard-deleted).
- `runLifecycleSweep({ organization, policyOverrides, batchSize })` —
  batch-evaluates and transitions every memory (optionally scoped to one
  organization), mirroring `recalculateAllImportanceScores`.

## Automatic vs. manual triggering

- **Automatic**: once `REDIS_URI` is configured, `initMemoryLifecycleWorker`
  (in `server/services/queueService.js`) schedules a recurring BullMQ job
  (`memory-lifecycle-queue`) that runs `runLifecycleSweep` across _all_
  organizations on the interval set by `LIFECYCLE_SWEEP_INTERVAL_MS`.
- **Manual**: `POST /api/knowledge/lifecycle/run` triggers a sweep for the
  caller's organization on demand (queued in the background if Redis is
  configured, run synchronously otherwise — same fallback pattern as
  `POST /api/knowledge/importance/recalculate`).
- **Per-memory**: `PATCH /api/knowledge/:type/:id/lifecycle` lets an
  admin/moderator manually move a single memory to any state (e.g. archive
  something early, or restore it).

Both endpoints require the `manage_lifecycle` permission on the
`knowledge` resource (owner/admin/moderator), matching how `consolidate`
and `resolve_conflicts` are scoped in `server/utils/rbacPermissions.js`.

## Intelligent restoration on reference

Archival never means "gone" — `recordMemoryAccess` (called whenever a
memory is retrieved, opened, or listed) now checks the memory's current
lifecycle state first. If it's anything other than `active`, the access
also transitions it back to `active` as part of the same call, with a
`"Restored automatically on reference"` entry in `lifecycleHistory`. This
satisfies the "intelligent restoration" requirement without needing a
separate polling process — a memory only needs to be referenced once to
come back.

## Retrieval behavior

`GET /api/knowledge/decisions` and `GET /api/knowledge/action-items`
exclude `archived` and `expired` memories by default. Pass
`?includeArchived=true` to include them (e.g. for an admin retention view).

## What's intentionally out of scope for this change

- A dedicated retention analytics dashboard (UI). The data needed for one
  (per-organization counts by state, transition history) is already
  produced by `runLifecycleSweep`'s summary and each memory's
  `lifecycleHistory`; wiring that into a frontend view is a natural
  fast-follow rather than part of the core mechanism.
- Per-organization, DB-configurable policies (vs. the current
  environment-variable-based global policy). Env vars satisfy "retention
  rules can be modified without code changes" for now; a settings-panel-
  backed per-org override is a reasonable follow-up if different orgs need
  different thresholds.
