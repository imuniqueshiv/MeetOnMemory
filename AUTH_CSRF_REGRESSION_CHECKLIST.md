# AUTH_CSRF_REGRESSION_CHECKLIST — RETIRED

**Status:** Obsolete after Clerk-only cutover (Issue #974 / Phase 5).

Cookie-based user sessions and the global `csurf` middleware have been removed.
Application authentication uses Clerk Bearer tokens only.

Use Clerk session QA instead:

- [ ] Sign in / sign up via Clerk UI (`/login`, `/signup`)
- [ ] Protected routes require a Clerk session
- [ ] API requests send `Authorization: Bearer <Clerk JWT>`
- [ ] Socket.IO / WebRTC connect with `auth.token` from Clerk
- [ ] Sign out clears Clerk session and MeetOnMemory AppContext
- [ ] Organization switch / RBAC still use MongoDB roles
- [ ] Shared-link passcodes, Slack state JWTs, and export download tokens still work
