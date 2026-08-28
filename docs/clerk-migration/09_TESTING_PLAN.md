# Testing Plan

> [!WARNING]
> **ARCHIVED / HISTORICAL DOCUMENTATION**  
> The Clerk authentication migration has been fully completed. Clerk is now the sole identity provider for MeetOnMemory.  
> For current contributor setup and development instructions, please refer to [AUTH_CONTRIBUTOR_RUNBOOK.md](../AUTH_CONTRIBUTOR_RUNBOOK.md).

## Principles

1. Legacy path must stay green until Phase 7.
2. Dual mode requires **both** cookie JWT and Clerk token fixtures.
3. Prefer extending existing Jest/Vitest suites over one mega E2E.
4. Manual QA gates every phase exit (`05_MIGRATION_CHECKLIST.md`).

---

## By phase

### Phase 1

| Type        | Focus                                                                      |
| ----------- | -------------------------------------------------------------------------- |
| Unit        | User schema accepts `clerkUserId`; legacy register still requires password |
| Integration | Existing `auth.test.js` / CSRF regression still pass                       |
| Manual      | Login, CSRF POST, logout, socket connect                                   |
| Security    | No secrets in `.env.example`                                               |

### Phase 2

| Type        | Focus                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| Unit        | Bridge: legacy JWT → `req.user`; Clerk JWT → linked user               |
| Integration | Protected meeting route with both auth modes                           |
| Negative    | Unknown Clerk user without link → controlled 401/403 or provision rule |
| Regression  | Calendar connect under legacy                                          |

### Phase 3

| Type       | Focus                                                   |
| ---------- | ------------------------------------------------------- |
| Component  | ProtectedRoute with mocked Clerk/legacy context         |
| Manual E2E | Flag on: Clerk sign-in → dashboard; Flag off: Login.jsx |
| CSRF       | Still required for legacy mutations                     |

### Phase 4

| Type        | Focus                                                       |
| ----------- | ----------------------------------------------------------- |
| Integration | Org create/join/select/invite accept with Clerk-linked user |
| RBAC        | `requirePermission` unchanged for roles                     |
| Manual      | Onboarding redirect rules                                   |

### Phase 5

| Type                  | Focus                                                             |
| --------------------- | ----------------------------------------------------------------- |
| Socket                | meeting / transcript / documentSync with Clerk auth               |
| WebRTC                | `useWebRTC` credentials                                           |
| Calendar              | Google connect + callback                                         |
| Slack                 | install + events signature                                        |
| Shared links / export | Secondary JWT flows                                               |
| AI                    | Assistant/knowledge routes with bridge                            |
| Legacy pages          | AiAssistant, TranscriptViewer, AvailabilityGrid use modern client |

### Phase 6

| Type        | Focus                             |
| ----------- | --------------------------------- |
| Script      | Backfill dry-run idempotency      |
| Manual      | Canary users only                 |
| Performance | Backfill rate limits vs Clerk API |

### Phase 7

| Type     | Focus                                                         |
| -------- | ------------------------------------------------------------- |
| Negative | Legacy login disabled returns clear error                     |
| Security | CSRF absence only if cookie JWT gone; session fixation checks |
| Soak     | 48–72h production                                             |

### Phase 8

| Type            | Focus                                        |
| --------------- | -------------------------------------------- |
| Full regression | Replace deleted auth tests with Clerk suites |
| Docs            | Cookie policy matches reality                |

---

## Cross-cutting suites to protect

| Area             | Existing anchors (verified paths)                                      |
| ---------------- | ---------------------------------------------------------------------- |
| Auth/CSRF        | `server/tests/auth*.js`, `csrfErrors.test.js`, `helpers/csrfHelper.js` |
| Integration      | `server/tests/integration.test.js`                                     |
| Org/invite       | `invitation.test.js`, Organization/Membership tests                    |
| RBAC             | `rbacMeetingIdRegression.test.js`, client `rbacPermissions` tests      |
| Slack            | `slack.test.js`                                                        |
| Gemini/summarize | `gemini.test.js`, `summarize.test.js`                                  |
| Frontend auth    | `AppContext*.test.jsx`, `ProtectedRoute.test.jsx`, `apiClient.test.js` |

---

## Performance

- Phase 6+: measure auth middleware latency (JWKS cache hit vs miss).
- **Not verified from source:** existing perf benchmarks for auth — assume none.

## Security testing

- Tampered Clerk token rejected
- User A token cannot access User B org resources (existing RBAC tests + bridge)
- CSRF bypass attempts on legacy mode
- Webhook signature verification for Clerk (when implemented)
