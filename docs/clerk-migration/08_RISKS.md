# Risks

| ID  | Risk                                             | Rank         | Mitigation                                                                        | Rollback                             | Monitoring                                         | Owner                     |
| --- | ------------------------------------------------ | ------------ | --------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------- | ------------------------- |
| R1  | Email mismatch creates duplicate Mongo users     | **Critical** | Normalized email upsert; unique email + sparse `clerkUserId`; linking transaction | Disable Clerk signup; legacy login   | Count users with null `clerkUserId` vs Clerk total | Maintainer / Phase 6 lead |
| R2  | Controllers break if `req.user._id` changes      | **Critical** | Always map Clerk → existing Mongo `_id`; never replace `_id`                      | `AUTH_PROVIDER=legacy`               | 500 rate on org/meeting routes                     | Phase 2 lead              |
| R3  | Socket auth outage (meetings/transcripts/collab) | **Critical** | Phase 5 dedicated; shared socket auth helper; fix WebRTC credentials              | Legacy cookie sockets                | WS connect error rate                              | Phase 5 lead              |
| R4  | CSRF removed while cookie JWT still active       | **Critical** | Hard rule in strategy; checklist gate                                             | Re-enable `csrfProtectionMiddleware` | CSRF_INVALID vs CSRF bypass exploits               | Phase 7 lead              |
| R5  | Calendar Google login confused with Clerk Google | **High**     | ADR non-goal; separate token stores; docs                                         | N/A                                  | Calendar sync failure rate                         | Phase 5                   |
| R6  | `password: required` blocks Clerk users          | **High**     | Phase 1 design + Phase 2 schema guard                                             | Revert schema PR                     | User create errors                                 | Phase 1–2                 |
| R7  | Incomplete backfill locks users out at cutover   | **High**     | Dry-run; canary; keep legacy until metrics OK                                     | Re-enable legacy login               | Login failure by cohort                            | Phase 6–7                 |
| R8  | Invitation accept before Clerk link              | **High**     | Phase 4: ensure Mongo user exists/linked before org writes                        | Legacy path                          | Invite accept errors                               | Phase 4                   |
| R9  | RBAC denormalized role stale vs Membership       | **Medium**   | Preserve existing sync in OrganizationService; add tests                          | N/A                                  | 403 spikes                                         | Phase 4                   |
| R10 | Legacy Bearer pages (`localStorage.token`)       | **Medium**   | Phase 5 standardize on apiClient/Clerk                                            | Feature flag                         | Page-level 401s                                    | Phase 5                   |
| R11 | Clerk outage                                     | **Medium**   | Status page runbook; dual period buffers                                          | Legacy until cutover                 | Clerk status + auth latency                        | On-call                   |
| R12 | Secondary JWT breakage (shared/export/Slack)     | **Medium**   | Explicit non-removal; regression tests                                            | Revert unrelated JWT changes         | Those flows’ error rates                           | Phase 5–7                 |
| R13 | Triple calendar token store inconsistency        | **Medium**   | Document; optional cleanup epic post-migration                                    | N/A                                  | Sync job failures                                  | Optional                  |
| R14 | `activityController` `currentOrganization` bug   | **Medium**   | Fix to `organization` early                                                       | Revert fix                           | Activity feed empty/errors                         | Any phase bugfix          |
| R15 | Secrets leaked in PRs                            | **High**     | `.env.example` placeholders only; secret scan                                     | Rotate keys                          | GitHub secret scanning                             | All                       |
| R16 | Contributor deletes auth files early             | **Medium**   | Contributor guide forbidden list; review                                          | Restore files from freeze tag        | —                                                  | Maintainers               |
| R17 | Test suite only covers legacy                    | **Medium**   | Dual harness Phase 1–2                                                            | —                                    | CI coverage of bridge                              | Phase 2                   |
| R18 | Privacy: exporting emails to Clerk               | **Medium**   | DPA / privacy policy update                                                       | Stop backfill                        | —                                                  | Maintainer                |
| R19 | Cutover without monitoring                       | **High**     | 48–72h window required                                                            | Rollback flag                        | Auth dashboards                                    | Phase 7                   |
| R20 | WebRTC already broken pre-Clerk                  | **Low–Med**  | Fix in Phase 5 regardless                                                         | —                                    | Join-meeting failures                              | Phase 5                   |

---

## Ranking summary

- **Critical:** R1–R4
- **High:** R5–R8, R15, R19
- **Medium:** R9–R14, R16–R18
- **Low / pre-existing:** R20
