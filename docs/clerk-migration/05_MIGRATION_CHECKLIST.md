# Migration Checklist

Use this at the end of **every** phase before authorizing the next.

Copy into the phase tracking issue and check boxes in comments.

---

## Universal (all phases)

### Development

- [ ] Only active-phase issues merged
- [ ] `AUTH_PROVIDER=legacy` still works (until Phase 7)
- [ ] No secrets committed
- [ ] Additive schema only (until Phase 8)

### Testing

- [ ] CI green on PR
- [ ] Phase-specific tests in `09_TESTING_PLAN.md` executed

### Manual QA

- [ ] Register/login/logout (legacy) smoke
- [ ] Authenticated meeting list/create smoke
- [ ] Org hub / select org smoke (if touched)

### Security

- [ ] CSRF still enforced for legacy cookie POSTs (until cutover)
- [ ] No new public route without auth review
- [ ] Calendar tokens not logged

### Deployment

- [ ] Backend/frontend env vars documented
- [ ] Deploy order respected (API before UI when contracts change)

### Rollback

- [ ] Rollback steps written in phase tracking issue
- [ ] Freeze tag `v1.0.0-jwt-stable` still reachable

### Monitoring

- [ ] Auth 401/403 rate watched post-deploy
- [ ] Error tracker (if any) reviewed — **Not verified from source** which SaaS is used in prod

### Documentation

- [ ] Phase notes updated in `04_PHASES.md` status (optional checkbox in tracking issue)
- [ ] CONTRIBUTING / env example updated if new vars

### Contributor

- [ ] PRs linked to issues
- [ ] No drive-by deletions of auth files

### Maintainer

- [ ] Exit criteria in `04_PHASES.md` explicitly confirmed
- [ ] Next phase issues authorized (or explicitly deferred)

### Release

- [ ] Optional tag `clerk-phaseN-complete`
- [ ] Changelog / release notes blurb

---

## Phase 1 extras

- [ ] ADR merged
- [ ] Auth inventory complete (HTTP, sockets, CSRF, secondary JWTs, legacy Bearer pages)
- [ ] `clerkUserId` sparse unique index
- [ ] Clerk env placeholders in `.env.example` only
- [ ] Threat model doc merged
- [ ] Manual: legacy login + CSRF POST + socket connect still work

## Phase 2 extras

- [ ] Dual middleware tests (legacy cookie + Clerk token)
- [ ] `/api/me` contract documented
- [ ] Calendar routes smoke under legacy

## Phase 3 extras

- [ ] Flagged Clerk login E2E manual
- [ ] Unflagged users still see legacy Login.jsx

## Phase 4 extras

- [ ] Invite accept with Clerk-linked user
- [ ] Onboarding completion flags correct

## Phase 5 extras

- [ ] WebRTC / transcript / collab sockets with Clerk
- [ ] Slack install + calendar connect smoke
- [ ] Shared link + export download still work

## Phase 6 extras

- [ ] Backfill dry-run report retained
- [ ] Canary cohort documented
- [ ] Support runbook published

## Phase 7 extras

- [ ] Legacy login disabled with kill switch
- [ ] CSRF removal justified in writing
- [ ] 48h auth error budget met

## Phase 8 extras

- [ ] `06_FILES_TO_REMOVE.md` items gone
- [ ] Password/OTP fields dropped after retention
- [ ] Cookie Policy / Security pages updated
