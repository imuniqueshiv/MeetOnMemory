# Migration Plan Verification

> [!WARNING]
> **ARCHIVED / HISTORICAL DOCUMENTATION**  
> The Clerk authentication migration has been fully completed. Clerk is now the sole identity provider for MeetOnMemory.  
> For current contributor setup and development instructions, please refer to [AUTH_CONTRIBUTOR_RUNBOOK.md](../AUTH_CONTRIBUTOR_RUNBOOK.md).

Review of the previously proposed Clerk migration (conversation / planning drafts) against the repository.

Legend: ✅ Verified · ⚠ Needs adjustment · ❌ Incorrect

| Recommendation                                          | Verdict | Why                                                                            |
| ------------------------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| Clerk as IdP only; Mongo keeps RBAC/orgs                | ✅      | Matches codebase: authorization is `rbac.js` + User/Membership, not JWT claims |
| Strangler + dual auth + feature flag                    | ✅      | Safest given sockets + CSRF + FK spine on Mongo `_id`                          |
| Big Bang cutover as primary strategy                    | ❌      | Too many coupled surfaces (HTTP, sockets, CSRF, onboarding)                    |
| Remove CSRF immediately when adding Clerk               | ❌      | Unsafe while cookie JWT remains; only after legacy cookie sessions gone        |
| Keep Integration Tests job forever                      | N/A     | Unrelated to Clerk; ignore                                                     |
| Phase “rewrite Organizations”                           | ⚠       | Orgs need **linking**, not rewrite; adjusted in `04_PHASES.md` Phase 4         |
| Delete `AuthService.js` wholesale in early phase        | ⚠       | Contains `googleCalendarCallback`; relocate calendar first                     |
| Google OAuth already provides login to replace          | ❌      | Only calendar OAuth exists                                                     |
| No refresh token to migrate                             | ✅      | App has no refresh rotation                                                    |
| Add `clerkUserId` additive                              | ✅      | Correct first schema step                                                      |
| `password` required must change                         | ✅      | Schema blocks Clerk-only users                                                 |
| Sockets need a dedicated phase                          | ✅      | Cookie JWT hardcoded in three modules                                          |
| Secondary JWTs removable with auth                      | ❌      | Shared/export/Slack state must remain                                          |
| Frontend AuthContext/UserContext rename target          | ⚠       | Actual context is `AppContent`/`AppContext` — plan against real names          |
| Dual Membership vs User.role ignored                    | ⚠       | Early plans understated denormalization; RBAC trusts User fields               |
| WebRTC works if HTTP auth works                         | ❌      | `useWebRTC` omits credentials; separate fix                                    |
| Calendar callbacks safe                                 | ⚠       | Some callbacks trust `state` as userId without `userAuth`                      |
| Move all product auth into Clerk session claims (roles) | ❌      | Would discard existing RBAC matrix; non-goal                                   |
| Fail closed if Clerk user has no Mongo row              | ⚠       | Policy choice: auto-provision vs 401 — must be decided in Phase 2 ADR addendum |
| Health/cron/workers blocked by auth migration           | ⚠       | Not auth, but express bootstrap edits can break mount order — regression-test  |

---

## Architecture challenges (accepted adjustments)

1. **Do not** treat Phase 4 as an org rewrite.
2. **Do not** remove CSRF in the same PR that introduces Clerk UI.
3. **Must** split calendar identity from `AuthService` before deleting it.
4. **Must** define provisioning policy for first-time Clerk users (link-by-email vs create).
5. **Must** fix or schedule `currentOrganization` and WebRTC credential bugs as explicit issues (can be Phase 1 inventory / Phase 5).

---

## Remaining disagreements with “enterprise Clerk Orgs”

Using Clerk Organizations for MeetOnMemory tenancy is **rejected for v1 migration** because:

- Membership + invitation + join policies already exist in Mongo
- RBAC roles include `moderator` / `guest` beyond Clerk’s default org roles
- Cost/complexity of dual org systems during migration is unjustified

Revisit only via a new ADR after identity cutover is stable.
