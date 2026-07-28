# Architecture Verification Report

Evidence-based checklist for the current auth system.

| Claim                                         | Status         | Evidence                                                                                                    |
| --------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| Email/password register & login               | ✅ Verified    | `AuthService.js`, `authControllers.js`, `authRoutes.js`                                                     |
| JWT payload `{ id }`, expiry 7d               | ✅ Verified    | `AuthService.register/login`                                                                                |
| Cookie name `token`, httpOnly                 | ✅ Verified    | `authControllers.js`                                                                                        |
| No refresh token endpoint                     | ✅ Verified    | No refresh route in `authRoutes.js`; grep shows no app refresh rotation                                     |
| Bearer alternate in `userAuth`                | ✅ Verified    | `userAuth.js`                                                                                               |
| Global CSRF via csurf                         | ✅ Verified    | `express.js`, `csrfProtection.js`                                                                           |
| CSRF bypasses: slack, webhooks, public shared | ✅ Verified    | `express.js` pre-CSRF mounts                                                                                |
| Auth routes need CSRF                         | ✅ Verified    | `authCsrfRegression.test.js`; not in bypass list                                                            |
| Google **login** OAuth                        | ❌ Not present | No passport; Login.jsx has no Google IdP button                                                             |
| Google **Calendar** OAuth                     | ✅ Verified    | `authRoutes` calendar paths + `calendarRoutes.js`                                                           |
| RBAC uses `User.role`                         | ✅ Verified    | `rbac.js`, `rbacPermissions.js`                                                                             |
| Membership roles narrower                     | ✅ Verified    | `membershipModel.js` enum `admin\|member`                                                                   |
| Socket cookie JWT auth                        | ✅ Verified    | `meetingSocket.js`, `transcriptSocket.js`, `documentSync.js`                                                |
| AppContext CSRF + is-auth bootstrap           | ✅ Verified    | `AppContext.jsx`                                                                                            |
| apiClient CSRF header                         | ✅ Verified    | `apiClient.js`, `csrfService.js`                                                                            |
| No Clerk today                                | ✅ Verified    | No Clerk deps/usage in app source (planning time)                                                           |
| `password` required on User                   | ✅ Verified    | `userModel.js`                                                                                              |
| ChatSession is not login session              | ✅ Verified    | `ChatSession.js` AI history                                                                                 |
| Secondary JWTs exist                          | ✅ Verified    | shared links, export, Slack state                                                                           |
| WebRTC missing withCredentials                | ✅ Verified    | `useWebRTC.js` has no `withCredentials`                                                                     |
| `currentOrganization` on user                 | ❌ Bug         | `activityController.js` vs schema `organization`                                                            |
| Production IdP for email                      | ✅ Verified    | nodemailer + templates                                                                                      |
| Exact prod hosting URLs                       | ⚠ Partial      | Health-check defaults to Render hostname; Vercel assumed from stack docs — **confirm in deploy dashboards** |
| Git semver tags                               | ⚠ None         | Recommend `v1.0.0-jwt-stable`                                                                               |
| Passport.js                                   | ❌ Not used    | No dependency usage found                                                                                   |

---

## Hidden integrations scanned

| Area                                | Auth coupling                                   | Notes                            |
| ----------------------------------- | ----------------------------------------------- | -------------------------------- |
| Meetings                            | `userAuth` + RBAC                               | High volume of routes            |
| Search / AI / knowledge / assistant | `userAuth`                                      | Org scoped                       |
| Policies / compliance               | `userAuth` + permissions                        |                                  |
| Analytics / gemini insights         | `userAuth` + reports permission                 |                                  |
| Notifications                       | `userAuth` + socket rooms                       |                                  |
| Tasks                               | Via knowledge action-items + `tasks` permission | No dedicated `/api/tasks` router |
| Calendar cron                       | `initCalendarSyncCron` in `server.js`           | Uses stored OAuth refresh tokens |
| Workers                             | `startWorkers`                                  | Not identity; regression on boot |
| Webhooks                            | CSRF bypassed; own auth                         |                                  |
| Slack                               | Install authed; events signed                   |                                  |
| Shared links                        | Public + secondary JWT                          |                                  |
| Export jobs                         | Secondary JWT                                   |                                  |
