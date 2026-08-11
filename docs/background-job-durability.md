# Background Job Durability

How MeetOnMemory guarantees that queued background work survives transient
failures and deploys. Added in response to [#975](https://github.com/imuniqueshiv/MeetOnMemory/issues/975).

## The problem this replaced

Every BullMQ queue used to be constructed as `new Queue(name, { connection })`
with no `defaultJobOptions`. BullMQ's own default is `attempts: 1`, so **any**
throw — a Redis blip, a Mongo failover, a Gemini `429` — permanently destroyed
the job. Nothing retried it, nothing recorded that it had vanished, and the user
was left with a spinner that never resolved.

Separately, `SIGTERM` only called `server.close()`, which stops the HTTP listener
and nothing else. In-flight jobs were killed mid-execution on every deploy and,
with `attempts: 1`, were never re-delivered.

## The model

### One factory, one policy

All queues are created through `getQueue(name)` in
`server/services/queueService.js`, which applies the defaults resolved by
`server/services/queueRegistry.js`. A new queue is one entry in
`QUEUE_DEFINITIONS` and it cannot accidentally ship without a retry policy.

Defaults (`BASE_JOB_OPTIONS`):

| Option             | Value                 | Why                                                                                 |
| ------------------ | --------------------- | ----------------------------------------------------------------------------------- |
| `attempts`         | `3`                   | Matches what `webhookDispatcherService` and `MeetingService` already chose by hand. |
| `backoff`          | exponential, `5000ms` | A retry storm against a rate-limited provider makes things worse, not better.       |
| `removeOnComplete` | 100 jobs / 24h        | Enough history to debug; bounded so Redis can't grow without limit.                 |
| `removeOnFail`     | 500 jobs / 7d         | Failures are what an operator needs to see, so they're kept longer.                 |

Retention matters more than it looks: `processAudioJob` payloads carry transcript
text, and unbounded retention leaks them into the same Redis instance that backs
the rate limiter (`middleware/rateLimiter.js`) and the Socket.IO adapter
(`config/socket.js`). An OOM there takes all three down at once.

### Per-queue overrides

`QUEUE_DEFINITIONS` records the deviations and why:

- `ai-mom-generation` — `attempts: 5`, `delay: 15000`. The most user-visible job
  and the most likely to hit a provider rate limit; a longer backoff gives a
  quota window time to reset.
- `memory-lifecycle-queue` — `attempts: 2`. The sweep is idempotent and re-runs
  on a schedule anyway, so a long retry tail buys nothing.
- `webhook-dispatches` — `attempts: 5`, `delay: 2000`. Unchanged from the values
  that were previously inline at the call site.

Per-call overrides still work and win over the queue's defaults:

```js
await conflictScanQueue.add("scan", { organization }, { jobId: "…" });
```

`resolveJobOptions` merges `backoff` field-by-field, so a caller can override
only `delay` without losing `type`. Retention accepts BullMQ's boolean, number
and object forms; the non-object forms replace rather than merge, so an existing
`removeOnComplete: true` still means exactly that.

### Shutdown ordering

`queueRegistry` tracks every queue, worker and shared Redis connection so
`shutdownQueues()` can close them in dependency order:

1. **workers** — `worker.close()` stops fetching new jobs and waits for in-flight
   ones to finish;
2. **queues** — producers only, safe once no worker is running;
3. **connections** — last, because a draining job is still issuing Redis commands.

Closing connections first (the naive ordering) makes in-flight jobs fail with a
connection error — precisely the data loss this exists to prevent.

`server/utils/gracefulShutdown.js` wraps that in the wider sequence:

```
SIGTERM → HTTP listener → Socket.IO → BullMQ workers → MongoDB → Redis → exit(0)
```

Each step is individually try/caught, so a failure in one does not leak the
connections the later steps would have closed. Every close is also individually
timeout-bounded, and the whole sequence has a hard deadline — if anything hangs,
the process force-exits rather than waiting for the platform to `SIGKILL` it.

Shutdown is idempotent: a second signal returns the in-flight promise instead of
starting a second teardown.

## Configuration

| Variable                        | Default    | Effect                                                           |
| ------------------------------- | ---------- | ---------------------------------------------------------------- |
| `SHUTDOWN_TIMEOUT_MS`           | `30000`    | Hard deadline for the whole shutdown sequence before force-exit. |
| `QUEUE_WORKER_CLOSE_TIMEOUT_MS` | `15000`    | Grace period for a single worker to finish its in-flight job.    |
| `QUEUE_CLOSE_TIMEOUT_MS`        | `5000`     | Budget for closing one queue or one Redis connection.            |
| `LIFECYCLE_SWEEP_INTERVAL_MS`   | `86400000` | Memory-lifecycle sweep interval (pre-existing).                  |

Set `SHUTDOWN_TIMEOUT_MS` **below** your platform's `SIGTERM`→`SIGKILL` grace
period (Kubernetes' `terminationGracePeriodSeconds`, Render's shutdown window),
so the app always wins the race and gets to drain on its own terms.

## Adding a new queue

1. Add an entry to `QUEUE_DEFINITIONS` in `queueRegistry.js`, overriding only
   what genuinely differs from the base policy.
2. Export a facade with `createQueueFacade("your-queue-name")`.
3. Add an `initYourWorker` that calls `createWorker({ … })` — registration for
   shutdown is automatic.
4. Add it to `startWorkers` in `config/workers.js`.

## Behaviour without Redis

Unchanged: when `REDIS_URI` is unset, `add()` logs a warning and resolves to
`null`, workers do not start, and the app boots normally. This keeps
frontend-only development working, and it is why the test suite
(`tests/setup.js` deletes `REDIS_URI`) can exercise the policy and shutdown logic
without any infrastructure.

## Observability

Worker logs now distinguish a retry from a final failure:

```
↻ AI Worker: job 42 failed attempt 1/5, will retry — 429 Too Many Requests
❌ AI Worker: job 42 permanently failed after 5/5 attempts — 429 Too Many Requests
⚠️ AI Worker: job 43 stalled and will be re-queued.
```

Previously every attempt logged an identical line, so a job about to be retried
was indistinguishable from one that had been abandoned.

`getQueueStatus()` returns the live queue/worker names and whether a shutdown is
in progress.
