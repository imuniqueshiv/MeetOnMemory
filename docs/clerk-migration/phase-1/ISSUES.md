# Phase 1 Issues — Foundation

**Active phase:** 1 only.  
**Do not** implement Phase 2+ until this list’s exit criteria pass.

Each issue is independently mergeable. Keep `main` deployable. Default auth behavior must remain legacy JWT + CSRF.

Suggested labels: `clerk-migration`, `phase-1`, `docs` / `chore` / `feat` as appropriate.

---

## Issue 1 — Tag Last Stable JWT Release

**Title:** `chore(auth): tag v1.0.0-jwt-stable as Last Stable JWT Release`

**Summary:** Create the annotated git tag documented in `docs/clerk-migration/00_VERSION_FREEZE.md` on current `main` before Clerk code lands.

**Problem:** No semver auth freeze tag exists; rollback target is unclear.

**Scope:**

- Tag `v1.0.0-jwt-stable` on agreed SHA
- Fill SHA/deploy fields in `00_VERSION_FREEZE.md`
- Push tag to origin

**Acceptance criteria:**

- [ ] Tag exists on origin
- [ ] Freeze doc lists SHA
- [ ] No application code changes required (docs OK)

**Rollback:** Delete tag only with maintainer consensus (prefer leave immutable).

---

## Issue 2 — ADR: Clerk as IdP, Mongo RBAC retained

**Title:** `docs(auth): ADR for Clerk identity with Mongo-backed RBAC`

**Summary:** Architecture Decision Record stating Clerk replaces identity/session only.

**Problem:** Contributors may attempt Clerk Organizations or JWT claim-based roles.

**Scope:**

- Add ADR under `docs/clerk-migration/` or `docs/adr/`
- Non-goals: Clerk Orgs, removing secondary JWTs, conflating calendar OAuth

**Acceptance criteria:**

- [ ] ADR merged
- [ ] Explicitly states Google Calendar OAuth ≠ Clerk Google login
- [ ] Maintainer approval comment

**Rollback:** Revert doc PR.

---

## Issue 3 — Auth touchpoint inventory

**Title:** `docs(auth): complete identity touchpoint inventory`

**Summary:** Checklist of every JWT/CSRF/socket/legacy Bearer/secondary JWT path.

**Problem:** Migration misses sockets or legacy client pages.

**Scope:**

- Document inventory (can extend `11_ARCHITECTURE_VERIFICATION.md`)
- Include: HTTP `userAuth` routers, 3 sockets, CSRF bypasses, shared/export/Slack JWTs, legacy Bearer files, calendar token stores
- Mark out-of-scope items clearly

**Acceptance criteria:**

- [ ] Inventory merged and linked from README
- [ ] WebRTC credentials gap and `currentOrganization` bug listed as known defects

**Rollback:** Revert doc PR.

---

## Issue 4 — Provision Clerk apps + env placeholders

**Title:** `chore(auth): document Clerk env vars and provision dev application`

**Summary:** Create Clerk development application; add placeholder env keys to `.env.example` (no secrets).

**Problem:** No IdP configuration path for contributors.

**Scope:**

- Clerk dashboard dev instance
- Document `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, issuer/JWKS guidance, `AUTH_PROVIDER`
- Update contributor env docs

**Acceptance criteria:**

- [ ] `.env.example` (or server/client examples) updated with placeholders
- [ ] No live secrets in git
- [ ] Setup steps in migration docs

**Rollback:** Revert doc/env example PR; delete Clerk app if needed.

---

## Issue 5 — Add `clerkUserId` to User model

**Title:** `feat(db): add sparse unique clerkUserId on User`

**Summary:** Additive schema field for future linking.

**Problem:** No join key to Clerk subject.

**Scope:**

- `server/models/userModel.js`
- Unique sparse index
- Do **not** remove password/OTP fields

**Acceptance criteria:**

- [ ] Field optional
- [ ] Unique sparse index defined
- [ ] Existing auth tests pass
- [ ] Legacy register/login unchanged

**Rollback:** Revert PR (field unused).

---

## Issue 6 — Password optionality design (and guarded implementation)

**Title:** `feat(db): allow missing password when clerkUserId is set`

**Summary:** Implement validation so legacy users still require password; Clerk-linked users may omit password.

**Problem:** `password: { required: true }` blocks future Clerk provisioning.

**Scope:**

- Schema/validator change with tests
- Legacy register path still hashes password
- Document rule in ADR or schema comment

**Acceptance criteria:**

- [ ] Creating user without password **and** without `clerkUserId` fails
- [ ] Creating user with `clerkUserId` and no password succeeds in unit test
- [ ] Legacy register integration still passes

**Rollback:** Revert schema PR.

---

## Issue 7 — `AUTH_PROVIDER` feature flag (legacy default)

**Title:** `feat(auth): add AUTH_PROVIDER config flag defaulting to legacy`

**Summary:** Boot-time config module for `legacy|dual|clerk`.

**Problem:** Need safe switch before dual middleware exists.

**Scope:**

- Small `server/config/authProvider.js` (or equivalent)
- Fail fast on invalid values
- Log active provider at boot
- **Do not** branch `userAuth` yet

**Acceptance criteria:**

- [ ] Default `legacy` when unset
- [ ] Invalid value prevents boot
- [ ] Documented in env example
- [ ] No change to request auth behavior

**Rollback:** Revert PR.

---

## Issue 8 — Clerk SDK dependencies + inert config stub

**Title:** `chore(auth): add Clerk SDKs with inert server config stub`

**Summary:** Install official Clerk packages; config module throws if invoked under `legacy`.

**Problem:** Need dependencies available without activating auth paths.

**Scope:**

- `server` and/or `client` package.json deps
- `server/config/clerk.js` stub
- Not wired into `userAuth` or React root yet

**Acceptance criteria:**

- [ ] `npm ci` succeeds in CI
- [ ] App boots with `AUTH_PROVIDER=legacy`
- [ ] Stub not imported from hot auth path

**Rollback:** Revert dependency PR.

---

## Issue 9 — Dual-mode test harness scaffolding

**Title:** `test(auth): scaffold dual-auth test helpers (legacy path live)`

**Summary:** Test helpers for legacy cookie users; placeholder hooks for Clerk tokens (skipped/disabled until Phase 2).

**Problem:** Later phases otherwise rewrite all fixtures at once.

**Scope:**

- Helper to create Mongo user + CSRF agent (wrap/reuse `csrfHelper`)
- Document how Clerk token fixture will plug in
- One sample test proving legacy still works via helper

**Acceptance criteria:**

- [ ] Legacy helper used by at least one passing test
- [ ] Clerk path clearly marked not required for CI green
- [ ] Existing auth suite remains green

**Rollback:** Revert test PR.

---

## Issue 10 — Threat model + Phase 1 exit checklist sign-off

**Title:** `docs(security): Clerk migration threat model and Phase 1 exit sign-off`

**Summary:** Threat model covering linking, CSRF removal gates, sockets, calendar separation; tracking checklist for Phase 1 exit.

**Problem:** Security and exit gates otherwise informal.

**Scope:**

- Threat model doc (or section in `08_RISKS.md` expansion)
- Phase 1 exit checklist issue comment template from `05_MIGRATION_CHECKLIST.md`
- Manual QA evidence attached (login, CSRF POST, socket)

**Acceptance criteria:**

- [ ] Threat model merged
- [ ] Maintainer records Phase 1 exit sign-off
- [ ] Explicit: do not remove CSRF until cookie JWT gone
- [ ] Authorization to generate Phase 2 issues granted in writing

**Rollback:** Docs-only revert.

---

## Phase 1 exit criteria (all issues)

- [ ] `v1.0.0-jwt-stable` tagged
- [ ] ADR + inventory + threat model merged
- [ ] `clerkUserId` + password guard merged
- [ ] `AUTH_PROVIDER` + inert Clerk stub merged
- [ ] Test harness scaffolding merged
- [ ] Legacy auth manually verified on a deploy or local smoke
- [ ] Maintainer authorizes Phase 2

**Stop here. Do not generate Phase 2 issues until exit is complete.**
