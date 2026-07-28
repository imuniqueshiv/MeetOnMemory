# Contributor Guide — Clerk Migration

## Purpose

How to contribute safely during the Clerk authentication migration.

---

## How to pick issues

1. Confirm the **active phase** with maintainers (see `04_PHASES.md`).
2. Only pick issues from that phase’s issue list (Phase 1: `phase-1/ISSUES.md`).
3. Prefer issues labeled `clerk-migration` + `phase-N`.
4. One contributor ↔ one issue ↔ one PR unless maintainers agree otherwise.

---

## Merge order

- Issues within a phase are designed to be **independently mergeable**.
- If two PRs touch the same file (e.g. `userModel.js`), coordinate or sequence them.
- **Never** merge Phase N+1 work before Phase N exit sign-off.

---

## Coding standards

- Match existing repo style (ESM, Express patterns, React patterns).
- Prefer small diffs; no drive-by refactors.
- Do not add `console.log` of tokens, cookies, or Authorization headers (existing `userAuth` logging should not be copied forward).
- New env vars: document in `.env.example` as placeholders only.

---

## Migration rules

1. Default production behavior remains **legacy JWT** until Phase 7.
2. Additive schema only until Phase 8.
3. Preserve Mongo `User._id` as the application identity key.
4. Keep CSRF while cookie JWT sessions exist.
5. Do not remove files listed in `06_FILES_TO_REMOVE.md` before Phase 8.
6. Calendar OAuth ≠ Clerk Google login.

---

## Forbidden changes

- Deleting `AuthService`, CSRF middleware, or Login.jsx early
- Moving org/RBAC into Clerk Organizations without a new ADR
- Changing `JWT_SECRET` secondary flows “for cleanup” without tests
- Committing Clerk secret keys
- Large unrelated refactors in migration PRs
- Skipping tests because “Clerk will replace them later”

---

## Review expectations

Reviewers must check:

- [ ] Flag/legacy path still works
- [ ] Rollback described
- [ ] No secret material
- [ ] Tests updated or justified
- [ ] Does not start next phase early
- [ ] Sockets/calendar considered if auth middleware changed

---

## Local testing minimum

```bash
# Server
cd server && npm test

# Client (as used in CI)
cd client && npm run lint && npm run test:ci
```

Manual: login → open a protected page → mutate (POST) with CSRF → logout.

---

## Getting help

- Architecture questions → `01_AUTHENTICATION_ARCHITECTURE.md` + `12_MIGRATION_PLAN_VERIFICATION.md`
- Risks → `08_RISKS.md`
- Ask maintainers before changing `userAuth`, CSRF, or socket auth
