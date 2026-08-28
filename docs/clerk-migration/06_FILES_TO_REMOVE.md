# Files To Remove

> [!WARNING]
> **ARCHIVED / HISTORICAL DOCUMENTATION**  
> The Clerk authentication migration has been fully completed. Clerk is now the sole identity provider for MeetOnMemory.  
> For current contributor setup and development instructions, please refer to [AUTH_CONTRIBUTOR_RUNBOOK.md](../AUTH_CONTRIBUTOR_RUNBOOK.md).

**When:** Phase 8 only (after cutover soak).  
**Rule:** Verified identity-layer obsolescence only.  
**Do not remove** during Phases 1–7.

If a file also contains calendar logic, **relocate calendar handlers first** (Phase 2/5), then delete the identity remainder.

---

## Backend

| File                                    | Why obsolete after cutover                                                  |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `server/middleware/userAuth.js`         | Replaced by Clerk→Mongo bridge                                              |
| `server/middleware/csrfProtection.js`   | CSRF removed with cookie JWT sessions                                       |
| `server/utils/csrfErrors.js`            | CSRF helper                                                                 |
| `server/services/AuthService.js`        | Password/JWT/OTP identity (**after** `googleCalendarCallback` moved)        |
| `server/controllers/authControllers.js` | Login/register/OTP/reset (**after** calendar handlers remounted)            |
| `server/routes/authRoutes.js`           | Identity routes (**after** calendar routes remounted under `/api/calendar`) |

---

## Frontend

| File                                     | Why obsolete after cutover                               |
| ---------------------------------------- | -------------------------------------------------------- |
| ~~`client/src/services/csrfService.js`~~ | **Removed** (Issue #1139) — unused after Clerk migration |
| `client/src/services/authApi.js`         | Legacy `/api/auth/*` identity API                        |
| `client/src/pages/Login.jsx`             | Replaced by Clerk UI                                     |
| `client/src/pages/EmailVerify.jsx`       | Clerk email verification                                 |
| `client/src/pages/ResetPassword.jsx`     | Clerk password reset                                     |

---

## Tests

| File                                                | Why                                                      |
| --------------------------------------------------- | -------------------------------------------------------- |
| `server/tests/auth.test.js`                         | Legacy identity                                          |
| `server/tests/AuthService.test.js`                  | Legacy identity                                          |
| `server/tests/authCsrfRegression.test.js`           | CSRF                                                     |
| `server/tests/authVerifyEmailRegression.test.js`    | OTP verify                                               |
| `server/tests/csrfErrors.test.js`                   | CSRF errors                                              |
| `server/tests/helpers/csrfHelper.js`                | CSRF test helper (replace with Clerk test helpers first) |
| `client/src/services/__tests__/csrfService.test.js` | **Removed with** `csrfService.js` (Issue #1139)          |
| `client/src/services/__tests__/authApi.test.js`     | Legacy auth API                                          |

Rewrite (do not silently delete without replacements): integration tests that only exist to exercise cookie+CSRF login (`integration.test.js` patterns).

---

## Utilities / scripts

| Item                                                | Notes                                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Email verify/reset templates used only for identity | `server/config/emailTemplates.js` — **partial**; keep if used elsewhere. **Verify usage before delete.** |
| Frontend `client/src/assets/emailTemplates.js`      | Marketing/assets copy — remove only if unused                                                            |

---

## Explicitly DO NOT remove

| File / area                                     | Reason                              |
| ----------------------------------------------- | ----------------------------------- |
| `server/middleware/rbac.js`                     | Authorization                       |
| `server/utils/rbacPermissions.js`               | Authorization                       |
| Org / membership / invitation models & services | Application domain                  |
| `server/socket/*.js`                            | Rewrite auth; do not delete sockets |
| Calendar services/models/jobs                   | Google API OAuth                    |
| `sharedLinkController.js` JWT                   | Shared access, not login            |
| Slack JWT `state` signing                       | Install flow                        |
| `exportDataJob.js` download tokens              | Export access                       |
| `ChatSession` model                             | AI sessions, not login              |
| `sessionRoutes` / session card controllers      | Product feature name collision      |

---

## Unverified

- Whether `nodeMailer` can be removed entirely after cutover — **Not verified from source** (may still send product emails).
