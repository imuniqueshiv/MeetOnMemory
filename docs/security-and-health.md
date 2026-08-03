# Security Headers & Health Probes

Added in response to [#979](https://github.com/imuniqueshiv/MeetOnMemory/issues/979).

## What was missing

```
$ grep -rn "helmet\|X-Frame-Options\|Content-Security-Policy" server/config server/server.js server/package.json
(no matches)
```

`configureExpress` applied CORS, body parsers, `cookie-parser`, CSRF and the rate
limiter — and nothing else. Every response, including the SPA and every JSON
payload, was served without `nosniff`, without frame protection, without a CSP,
without HSTS, and with `X-Powered-By: Express`.

Separately, `/health` was a static handler that returned `200 UP` unconditionally
— even with MongoDB down — and `.github/workflows/health-check.yml` polls it, so
the monitoring that existed was structurally incapable of detecting a database
outage.

## Security headers

| Header                         | Value                             | Why                                                                                           |
| ------------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `X-Content-Type-Options`       | `nosniff`                         | Stops a browser MIME-sniffing a JSON or user-uploaded response into an executable type.       |
| `X-Frame-Options`              | `DENY`                            | The whole authenticated app could previously be framed by any origin.                         |
| CSP `frame-ancestors`          | `'none'`                          | The modern equivalent, for browsers that honour CSP over the legacy header.                   |
| `Referrer-Policy`              | `strict-origin-when-cross-origin` | Full URLs, including paths carrying meeting and organization IDs, leaked to third parties.    |
| `Strict-Transport-Security`    | 1 year, production only           | Sending HSTS from a local HTTP dev server pins the browser to `https://localhost` for a year. |
| `Cross-Origin-Resource-Policy` | `cross-origin`                    | `same-origin` would break split-origin deployments.                                           |

Clickjacking is worth calling out: **CSRF tokens do not mitigate it.** The victim
performs the click themselves, inside the frame, so the request carries a valid
token.

### CSP is report-only by default

`CSP_ENFORCE=true` switches it to enforcing. Shipping an enforcing CSP blind is
how CSP rollouts get reverted and never attempted again — deploy report-only,
read the violation reports, then flip.

The directives are written out explicitly rather than inheriting helmet's
defaults, because several have to be loosened for this app and it should be
obvious _which_ and _why_:

- `styleSrc` allows `'unsafe-inline'` — Vite injects inline styles and Tailwind
  sets style attributes. Far less dangerous than the script equivalent.
- `scriptSrc` allows **neither** `'unsafe-inline'` nor `'unsafe-eval'`. If the
  build turns out to need one, that should be a reviewed change rather than
  something the policy grants pre-emptively.
- `imgSrc` / `mediaSrc` allow `https:` and `blob:` — attachments, org logos,
  avatars, uploaded recordings, and in-browser recording previews.
- `connectSrc` allows `wss:`/`ws:` for Socket.IO.

CSP matters here specifically: this repo has an ongoing series of HTML-injection
hardening issues (#833, #804, #613). A CSP is the layer that contains the impact
of the next one that slips through.

## Health probes

Three endpoints with genuinely different contracts:

| Endpoint            | Checks dependencies? | A failure means                 |
| ------------------- | -------------------- | ------------------------------- |
| `GET /health/live`  | No                   | "restart me"                    |
| `GET /health/ready` | Yes                  | "route around me"               |
| `GET /health`       | Yes                  | aggregate, backwards-compatible |

**Liveness never fails for a downstream outage.** Restarting wouldn't fix a dead
database, and doing it fleet-wide during a database incident turns a partial
outage into a total one.

`GET /health` keeps its original `status` / `timestamp` / `env` fields exactly,
so `health-check.yml` and any external monitor keep working. It adds
`dependencies`, `uptimeSeconds`, and returns `503` when a required dependency is
down.

### Dependency checks

- **MongoDB** — required. `readyState` alone isn't trusted (it can report
  `connected` while the socket is dead), so a real `admin().ping()` is issued.
- **Redis** — **degraded, not down**, and `required: false`. The app is
  explicitly designed to run without it: `redisService` disables itself after 3
  failed retries and the rate limiter, cache and Socket.IO adapter all fall back.
  Failing readiness on Redis would take the whole deployment out for a non-fatal
  condition.

Every check is individually timeout-bounded (`HEALTH_CHECK_TIMEOUT_MS`, default
2s). A probe that _hangs_ is worse than one that fails: the orchestrator gets no
answer and falls back to its own much longer timeout, during which a broken
instance keeps taking traffic.

Health routes are registered **before** the global rate limiter — a rate-limited
readiness probe would report an instance as unhealthy purely because it was being
polled.

## Request correlation

`middleware/requestContext.js` attaches an id to every request, echoes it as
`X-Request-Id`, and includes it in error logs and 500 response bodies. Previously
`errorHandler` logged only `console.error("❌ Unhandled error:", err)` — no
request id, no path, no user — so a user reporting "it failed" gave nothing to
search for.

An inbound `X-Request-Id` is reused when it matches `^[A-Za-z0-9._-]{1,128}$`,
so a trace started at a load balancer carries through. Anything else is replaced:
the value is echoed in a header and written into logs, so it is
attacker-controlled input, and a newline in a log line can forge entries.

Log context is passed through `redact()`, which masks `password`, `token`,
`secret`, `authorization`, `cookie`, `apiKey` and friends at any depth. This repo
has already had to fix sensitive auth data in server logs once (#612); redacting
at the logging boundary means a future field can't quietly become a leak.

## Body size limits

`express.json({ limit: "50mb" })` was applied **globally**, so every endpoint —
login, notification preferences, comment creation — would buffer and JSON-parse a
50 MB body before any handler, validator or auth check ran.

Now `BODY_LIMIT` (default `2mb`) applies everywhere, and `LARGE_BODY_LIMIT`
(default `50mb`) applies only to an explicit allow-list of routes that genuinely
receive large payloads. Raising a limit is a visible decision rather than a
global default.

An oversized body now returns **413** rather than 500 — it previously fell
through to the catch-all, telling the client "we broke" when in fact they sent
too much.

## Configuration

| Variable                  | Default | Effect                                             |
| ------------------------- | ------- | -------------------------------------------------- |
| `CSP_ENFORCE`             | `false` | `true` switches CSP from report-only to enforcing. |
| `HEALTH_CHECK_TIMEOUT_MS` | `2000`  | Per-dependency probe deadline.                     |
| `BODY_LIMIT`              | `2mb`   | Default request body limit.                        |
| `LARGE_BODY_LIMIT`        | `50mb`  | Limit for upload/transcript routes.                |

## Deployment notes

- Point orchestrator probes at `/health/live` (liveness) and `/health/ready`
  (readiness). Keep any existing monitor on `/health` — its response shape is
  unchanged, it just tells the truth now.
- Roll out with `CSP_ENFORCE` unset, collect violation reports, then set it to
  `true`.
