# AI Generation Resilience

How MeetOnMemory handles Gemini being slow, rate-limited, or down. Added in
response to [#976](https://github.com/imuniqueshiv/MeetOnMemory/issues/976).

## The failure this replaced

`generateMoMWithAI` wrapped its Gemini call in a single `try`, and the `catch`
treated every error identically:

```js
} catch (gemErr) {
  console.error("❌ Gemini API error, falling back to HuggingFace:", gemErr.message);
}
```

Below that, the fallback ran `textToSummarize.substring(0, 1024)` through
distilbart and returned an object with `decisions: []`, `action_items: []`,
`attendees: []` hardcoded.

So a single `429` — the _normal_ condition on the free tier this code targets —
produced a MoM summarised from the opening few sentences of the meeting, with no
decisions and no action items, which was then persisted and displayed as a
finished result. Every downstream feature (decision graph, tasks board, conflict
detection, policy compliance, action-item reminders) saw an empty meeting. The
only trace was a free-text `notes` string, so there was no way to find the
affected meetings afterwards.

There was also no timeout anywhere. `@google/generative-ai` uses `fetch`, which
has no default timeout, and the AI worker runs at `concurrency: 1` — so one hung
call stalled MoM generation for every organization until the process restarted.

## The model

`server/utils/aiResilience.js` provides the pieces; `GenerativeAIService.js`
composes them. Order matters:

```
circuit breaker  →  retry (backoff + jitter)  →  timeout  →  provider
```

- The **breaker is outermost** so an open circuit costs nothing.
- The **timeout is innermost** so it bounds each _attempt_, not the whole retry
  sequence. A 3-attempt call with a 60s timeout should be able to spend 60s per
  attempt, not 60s in total.

### Error classification decides everything

`classifyAiError(err)` returns `{ kind, status, retryable, retryAfterMs }`.

| Condition                                     | Kind              | Retried? |
| --------------------------------------------- | ----------------- | -------- |
| `429`, `RESOURCE_EXHAUSTED`, "quota exceeded" | `rate_limit`      | yes      |
| `500`/`502`/`503`/`504`, "overloaded"         | `server`          | yes      |
| `408`, `AbortError`, our own timeout          | `timeout`         | yes      |
| `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, …     | `network`         | yes      |
| `401`, `403`, "API key not valid"             | `auth`            | **no**   |
| other `4xx`                                   | `invalid_request` | **no**   |
| anything unrecognised                         | `unknown`         | **no**   |

Unrecognised errors default to **not retryable**. That's deliberate: an error we
can't classify is more likely a bug in our own request than a blip on the wire,
and retrying it just burns the timeout budget and delays the fallback.

Getting the SDK's status out is fiddly — `@google/generative-ai` has no stable
`status` field and commonly throws a `GoogleGenerativeAIFetchError` whose message
begins `[429 Too Many Requests] …`. Structured fields are checked first, then the
message.

### Backoff honours the provider

`computeBackoffDelay` uses **full jitter**, not a fixed multiplier: when a batch
of queued jobs all trip the same rate limit, un-jittered backoff makes them retry
in lockstep and hit the limit again together.

A provider-supplied hint always wins, from either source:

- a `Retry-After` response header (seconds or an HTTP date), or
- Google's `RetryInfo` error detail (`retryDelay: "31s"`).

The provider knows when its quota window resets; we don't.

### Prompt budgeting instead of truncation

`chunkTextByBudget` replaces `.substring(0, 1024)`. Long transcripts are split at
natural boundaries (paragraph, then sentence, then a hard cut) with a small
overlap so a decision stated across a seam isn't lost by either chunk. Each chunk
is extracted separately and `mergeMoMParts` combines them, de-duplicating
case-insensitively — the overlap deliberately feeds the same sentences to two
chunks, and the model will usually restate a straddling decision in both.

This matters most for the _longest_ meetings, which under the old code were the
ones most likely to blow the context window and get dumped to the 1024-character
fallback.

### Degradation is recorded, not implied

`generateMoMDetailed()` returns `{ mom, generation }`, and `normalizeMoM` carries
`generation` into the persisted `structuredMoM` (a `Mixed` field, so no migration
was needed):

```json
{
  "provider": "local-distilbart",
  "degraded": true,
  "reason": "gemini_failed",
  "errorKind": "rate_limit",
  "truncated": true,
  "inputCharsUsed": 1024,
  "inputCharsTotal": 48213,
  "chunks": 1,
  "generatedAt": "2026-08-01T09:14:22.104Z"
}
```

Degraded meetings are now findable:

```js
db.meetings.find({ "structuredMoM.generation.degraded": true });
```

`buildHumanReadableMoM` also adds a visible notice to a degraded document —
without it, an empty "Decisions" section reads as "no decisions were made"
rather than "we never analysed most of the meeting".

Legacy MoMs written before this field existed default to
`{ provider: "unknown", degraded: false }`. Absence of evidence isn't evidence of
degradation, and flagging every historical MoM as suspect would make the flag
useless.

### Circuit breaker

After `GEMINI_BREAKER_THRESHOLD` consecutive provider failures the breaker opens
and subsequent calls fail fast to the fallback. With `concurrency: 1`, a 60s
timeout and 5 attempts, re-confirming a known outage costs minutes of dead time
per job.

Only failures that are plausibly the _provider's_ fault count. A `400` from a
malformed prompt is not evidence Gemini is down, and opening on it would suppress
every other caller.

After `GEMINI_BREAKER_COOLDOWN_MS` the breaker half-opens and the next call acts
as a probe: success closes it, failure re-opens it.

## Configuration

| Variable                     | Default | Effect                                                                     |
| ---------------------------- | ------- | -------------------------------------------------------------------------- |
| `GEMINI_TIMEOUT_MS`          | `60000` | Per-attempt deadline.                                                      |
| `GEMINI_MAX_RETRIES`         | `3`     | Additional attempts after the first, retryable failures only.              |
| `GEMINI_RETRY_BASE_DELAY_MS` | `2000`  | First backoff step.                                                        |
| `GEMINI_RETRY_MAX_DELAY_MS`  | `30000` | Backoff ceiling.                                                           |
| `GEMINI_MAX_PROMPT_CHARS`    | `24000` | Transcript budget per prompt; above this, chunking kicks in.               |
| `GEMINI_CHUNK_OVERLAP_CHARS` | `500`   | Context carried across a chunk seam.                                       |
| `GEMINI_MAX_CHUNKS`          | `8`     | Fan-out cap. Exceeding it is recorded as `reason: "chunk_limit_exceeded"`. |
| `GEMINI_BREAKER_THRESHOLD`   | `5`     | Consecutive provider failures before the breaker opens.                    |
| `GEMINI_BREAKER_COOLDOWN_MS` | `60000` | How long the breaker stays open before probing.                            |

Breaker settings are read once at module load; the rest are read per call.

## Operating notes

- **A spike in `degraded: true` means check the provider**, not the code. The
  `errorKind` field tells you which way it's failing.
- **`⚡ Gemini circuit breaker: closed → open`** in the logs means every MoM job
  is now taking the fallback path. Meetings processed during that window are
  worth reprocessing once it closes.
- **Raise `GEMINI_MAX_CHUNKS`** if `reason: "chunk_limit_exceeded"` starts
  appearing — that means meetings are long enough that trailing chunks are being
  skipped.
