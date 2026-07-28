# Version Freeze — Last Stable JWT Release

## Recommended tag

```text
v1.0.0-jwt-stable
```

### Why this name

| Evidence                           | Value                                              |
| ---------------------------------- | -------------------------------------------------- |
| Git tags in repository             | **None found** (`git tag -l` empty as of planning) |
| `server/package.json` `version`    | `1.0.0`                                            |
| `client/package.json` `version`    | `0.0.0`                                            |
| Root `package.json` `version`      | **Not set**                                        |
| Planning baseline commit (example) | Current `main` tip at freeze time                  |

Semantic meaning: **v1.0.0** aligns with the server package major line; suffix **`jwt-stable`** marks the last production identity stack before Clerk work lands.

> Maintainers: create the tag on the exact `main` SHA immediately **before** the first Phase 1 merge that adds Clerk dependencies or schema fields.

```bash
git checkout main
git pull
git tag -a v1.0.0-jwt-stable -m "Last Stable JWT Release — pre-Clerk migration freeze"
git push origin v1.0.0-jwt-stable
```

---

## Purpose

1. Immutable rollback point if Clerk dual-auth or cutover fails.
2. Clear contributor baseline: “behavior of `v1.0.0-jwt-stable` is the JWT contract.”
3. Audit anchor for security reviews comparing before/after.

---

## What this release contains (authentication)

Verified at planning time:

| Capability                    | Implementation                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| Register / login / logout     | `server/services/AuthService.js`, `server/controllers/authControllers.js`, `server/routes/authRoutes.js` |
| Session                       | JWT `{ id }` in cookie `token`, `expiresIn: "7d"`                                                        |
| CSRF                          | Global `csurf` in `server/config/express.js`                                                             |
| Email verify / password reset | OTP fields on User + nodemailer                                                                          |
| Google                        | Calendar OAuth only (`/api/auth/google-calendar`, `/api/calendar/...`)                                   |
| Authorization                 | `userAuth` + `server/middleware/rbac.js` + Mongo org/membership                                          |

---

## Deployment state at freeze

Document at tag time (fill in when tagging):

| Field                    | Value                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Git SHA                  | _TBD at freeze_                                                                                                                             |
| Frontend deploy          | Vercel (assumed from project stack; **confirm in deploy dashboard**)                                                                        |
| Backend deploy           | Render (health-check workflow references Render; **confirm**)                                                                               |
| `AUTH_PROVIDER`          | N/A (flag does not exist yet)                                                                                                               |
| Known auth bugs deferred | See `08_RISKS.md` and `12_MIGRATION_PLAN_VERIFICATION.md` (e.g. WebRTC credentials, calendar callback `state` trust, `currentOrganization`) |

---

## Rollback point

| Scenario                         | Action                                                                 |
| -------------------------------- | ---------------------------------------------------------------------- |
| Phase 1–6 regression             | Revert Clerk PRs; redeploy `v1.0.0-jwt-stable`                         |
| Schema already has `clerkUserId` | Field is additive/sparse — safe to leave unused                        |
| Phase 7+ cutover failure         | Restore JWT cookie auth from this tag; re-enable CSRF; keep Mongo data |

**Do not delete** OTP/password fields until Phase 8 cleanup after a soak period past cutover.

---

## Freeze rules (until Phase 1 starts)

1. No Clerk SDK merges until this tag exists.
2. Hotfixes to JWT auth after the tag must be cherry-picked carefully or retagged (`v1.0.1-jwt-stable`) with maintainer approval.
3. Feature work unrelated to auth may continue on `main` normally.
