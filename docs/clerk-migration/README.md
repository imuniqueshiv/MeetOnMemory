# Clerk Authentication Migration — Official Guide

**Status:** Production cutover complete for identity (Issue #974). Clerk is the sole identity provider.  
**Scope:** Identity/session = Clerk Bearer tokens. Authorization = MongoDB RBAC.  
**Preserve:** Organizations, Memberships, RBAC, Meetings, Policies, AI, Analytics, Calendar (Google API OAuth), Notifications, Tasks, Slack, shared-link/export/Slack-state JWTs.

Historical planning docs below remain for audit; prefer README + `.env.example` for current setup.

This directory is the source of truth for the MeetOnMemory Clerk migration program.

---

## Document index

| #   | Document                                                                 | Purpose                                |
| --- | ------------------------------------------------------------------------ | -------------------------------------- |
| 0   | [00_VERSION_FREEZE.md](./00_VERSION_FREEZE.md)                           | Last Stable JWT Release tag            |
| 1   | [01_AUTHENTICATION_ARCHITECTURE.md](./01_AUTHENTICATION_ARCHITECTURE.md) | Current auth system (verified)         |
| 2   | [02_CLERK_MIGRATION_PROPOSAL.md](./02_CLERK_MIGRATION_PROPOSAL.md)       | Why migrate; comparisons               |
| 3   | [03_MIGRATION_STRATEGY.md](./03_MIGRATION_STRATEGY.md)                   | Master program rules                   |
| 4   | [04_PHASES.md](./04_PHASES.md)                                           | Phase roadmap (source of truth)        |
| 5   | [05_MIGRATION_CHECKLIST.md](./05_MIGRATION_CHECKLIST.md)                 | Per-phase production checklists        |
| 6   | [06_FILES_TO_REMOVE.md](./06_FILES_TO_REMOVE.md)                         | Verified obsolete files (post-cutover) |
| 7   | [07_FILES_TO_MODIFY.md](./07_FILES_TO_MODIFY.md)                         | Files to change by phase               |
| 8   | [08_RISKS.md](./08_RISKS.md)                                             | Ranked risks + mitigations             |
| 9   | [09_TESTING_PLAN.md](./09_TESTING_PLAN.md)                               | Testing strategy by phase              |
| 10  | [10_CONTRIBUTOR_GUIDE.md](./10_CONTRIBUTOR_GUIDE.md)                     | How contributors execute work          |
| 11  | [11_ARCHITECTURE_VERIFICATION.md](./11_ARCHITECTURE_VERIFICATION.md)     | Evidence checklist                     |
| 12  | [12_MIGRATION_PLAN_VERIFICATION.md](./12_MIGRATION_PLAN_VERIFICATION.md) | Challenge of prior recommendations     |
| —   | [phase-1/ISSUES.md](./phase-1/ISSUES.md)                                 | **Phase 1 issues only**                |

---

## Executive summary

MeetOnMemory authenticates with a **self-issued JWT** stored in an HttpOnly cookie named `token` (7-day expiry, **no refresh rotation**), plus **global CSRF** (`csurf`) for mutating requests. Authorization (RBAC, org membership) is **application-owned** in MongoDB and must remain there.

Clerk will become the **Identity Provider only**. After each merged PR, `main` must stay deployable. Migration uses a **Strangler + Dual Authentication + Feature Flag** strategy across eight phases. **Only Phase 1 issues are authorized until Phase 1 exits.**

### Critical verified facts

1. There is **no Google/GitHub login** today — Google OAuth is **calendar-only**.
2. RBAC reads `User.role` / `User.organization`, **not** `Membership.role`.
3. Sockets authenticate via cookie `token` + `jwt.verify` (three socket modules).
4. Secondary JWTs (shared links, export downloads, Slack OAuth state) are **not** login sessions — keep them.
5. `User.password` is `required: true` — must be relaxed before Clerk-only users can be persisted.

### How to use this program

1. Tag the JWT freeze release (see `00_VERSION_FREEZE.md`).
2. Complete **Phase 1** issues only (`phase-1/ISSUES.md`).
3. Stop. Request Phase 2 issues after Phase 1 exit criteria pass.
4. Never start Phase N+1 until Phase N is merged and checklist-complete.
