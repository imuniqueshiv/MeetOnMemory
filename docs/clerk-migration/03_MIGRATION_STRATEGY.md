# Migration Strategy (Master Program)

> [!WARNING]
> **ARCHIVED / HISTORICAL DOCUMENTATION**  
> The Clerk authentication migration has been fully completed. Clerk is now the sole identity provider for MeetOnMemory.  
> For current contributor setup and development instructions, please refer to [AUTH_CONTRIBUTOR_RUNBOOK.md](../AUTH_CONTRIBUTOR_RUNBOOK.md).

## 1. Philosophy

**Strangler Fig + Dual Authentication + Feature Flag.**

Replace identity incrementally. Never break Mongo `_id` continuity. Keep `main` deployable after every merge. Prefer many small PRs over epic branches.

---

## 2. Rules (non-negotiable)

1. **No migration code before** `v1.0.0-jwt-stable` tag exists.
2. **One phase at a time.** Do not open Phase N+1 issues until Phase N exit criteria pass.
3. Every PR must leave legacy auth working when `AUTH_PROVIDER=legacy` (until Phase 7).
4. Preserve `req.user` Mongo document shape for controllers (`_id`, `role`, `organization`, …).
5. Do not remove CSRF while cookie JWT sessions still exist.
6. Do not conflate Clerk Google **login** with Google **Calendar** OAuth.
7. Do not delete secondary JWTs (shared links, exports, Slack state).
8. Schema changes are additive until Phase 8.
9. No secrets in git.
10. Issues in a phase should be independently mergeable whenever possible.

---

## 3. Contributor guidelines

See `10_CONTRIBUTOR_GUIDE.md`. Summary:

- Pick issues labeled for the **active phase only**.
- One issue ≈ one PR.
- Include test plan + rollback notes in PR body.
- Do not “helpfully” delete auth files early.

---

## 4. Branch strategy

| Branch                        | Use                 |
| ----------------------------- | ------------------- |
| `main`                        | Always deployable   |
| `feat/clerk-phaseN-<short>`   | Single issue work   |
| Avoid long-lived `clerk-epic` | Prevents merge hell |

Rebase/merge from `main` frequently. No force-push to `main`.

---

## 5. Merge strategy

- Squash or merge commits per repo convention (follow existing PR style).
- Require CI green (path-filtered CI still applies).
- Maintainer review required for anything touching `userAuth`, CSRF, sockets, User schema.
- Phase exit: maintainer checklist in `05_MIGRATION_CHECKLIST.md` signed off in a tracking issue comment.

---

## 6. Release strategy

| Milestone         | Action                                           |
| ----------------- | ------------------------------------------------ |
| Pre-Phase 1       | Tag `v1.0.0-jwt-stable`                          |
| End of each phase | Optional lightweight tag `clerk-phaseN-complete` |
| Phase 7 cutover   | Production change management + monitoring window |
| Phase 8           | Cleanup release notes                            |

---

## 7. Rollback strategy

| Stage     | Rollback                                                                 |
| --------- | ------------------------------------------------------------------------ |
| Phase 1–2 | Revert PR; unused `clerkUserId` harmless                                 |
| Phase 3–5 | Set `AUTH_PROVIDER=legacy`; redeploy                                     |
| Phase 6   | Stop backfill; legacy login remains                                      |
| Phase 7   | Re-enable legacy; restore CSRF if removed; redeploy freeze tag if needed |
| Phase 8   | Only after soak — hard to rollback dropped columns; delay drops          |

---

## 8. Testing strategy

See `09_TESTING_PLAN.md`. Minimum per PR:

- Unit/integration for touched auth paths
- Manual smoke: login, CSRF POST, one protected meeting route, one socket path (when relevant)

---

## 9. Deployment strategy

1. Deploy backend before frontend when bridge contracts change.
2. Feature flag defaults to `legacy` in production until Phase 7.
3. Canary Clerk users via allowlist email domain or Clerk invitation cohort (Phase 6).
4. Calendar cron (`initCalendarSyncCron`) and workers must keep running across deploys — unrelated to identity but must not be broken by express bootstrap changes.

---

## 10. Feature flags

| Flag            | Values                        | Default until Phase 7 |
| --------------- | ----------------------------- | --------------------- |
| `AUTH_PROVIDER` | `legacy` \| `dual` \| `clerk` | `legacy`              |

Optional later: `CLERK_ALLOWLIST` for dual canary.

Invalid values → **fail fast at boot**.

---

## 11. Dual authentication period

**Phases 2–6:**

- Legacy: cookie JWT + CSRF (unchanged for default users)
- Clerk: verified Clerk JWT/session → resolve Mongo user by `clerkUserId` or email link → set `req.user`

Bridge middleware replaces or wraps `userAuth` behind the flag.

---

## 12. Cutover strategy (Phase 7)

1. Backfill complete for active users.
2. Default `AUTH_PROVIDER=clerk`.
3. Disable legacy register; then disable legacy login after soak.
4. Stop setting cookie `token`.
5. Remove global CSRF only when no legacy cookie session path remains.
6. Monitor auth error rates 48–72h.

---

## 13. Cleanup strategy (Phase 8)

Remove obsolete identity files listed in `06_FILES_TO_REMOVE.md`. Drop OTP/password fields after retention window. Rewrite tests. Update CONTRIBUTING and Cookie Policy.

---

## 14. Risk management

Track in `08_RISKS.md`. Critical risks require named owner before Phase 2 starts.

---

## 15. Success criteria (program-level)

- Users authenticate via Clerk in production
- All protected APIs and sockets authorize via Mongo `req.user` / socket userId
- Org/RBAC behavior unchanged for migrated users
- Legacy identity code removed after soak
- Freeze tag remains valid rollback for pre-migration state

---

## 16. Exit criteria (program-level)

- Phase 8 checklist complete
- No `AUTH_PROVIDER=legacy` in production
- Security review signed
- Docs updated; Phase issue epics closed
