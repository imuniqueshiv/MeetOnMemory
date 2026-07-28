# Files To Modify

Effort: **S** &lt; 0.5d · **M** 0.5–2d · **L** &gt; 2d  
Risk: Low / Medium / High / Critical

Only lists verified touchpoints. Controllers that merely read `req.user` after middleware are **Low** unless noted.

---

## Backend — core identity

| File                                    | Purpose                 | Reason                                   | Phase  | Risk     | Deps            | Effort |
| --------------------------------------- | ----------------------- | ---------------------------------------- | ------ | -------- | --------------- | ------ |
| `server/models/userModel.js`            | User schema             | Add `clerkUserId`; later relax password  | 1, 8   | High     | migrations      | M      |
| `server/middleware/userAuth.js`         | Session → `req.user`    | Dual/Clerk verify                        | 2, 7   | Critical | Clerk SDK, flag | L      |
| `server/config/express.js`              | Bootstrap CSRF/cors     | Gate/remove CSRF; Clerk middleware       | 2, 7   | Critical | flag            | L      |
| `server/server.js`                      | Boot / JWT_SECRET check | Clerk secrets; flag validation           | 1–2, 7 | High     | env             | M      |
| `server/routes/authRoutes.js`           | Auth + calendar entry   | Shrink; remount calendar                 | 2, 7–8 | High     | calendar routes | M      |
| `server/controllers/authControllers.js` | Auth handlers           | Dual then delete                         | 2, 7–8 | High     | AuthService     | M      |
| `server/services/AuthService.js`        | Identity logic          | Split calendar callback; delete identity | 2, 8   | High     | calendarService | L      |
| `server/config/corsOptions.js`          | CORS                    | Clerk frontend origins                   | 3      | Med      | deploy URLs     | S      |
| `.env.example` (if present) / env docs  | Config                  | Clerk + `AUTH_PROVIDER`                  | 1      | Low      | —               | S      |

---

## Backend — sockets

| File                                | Purpose             | Reason              | Phase | Risk     | Deps   | Effort |
| ----------------------------------- | ------------------- | ------------------- | ----- | -------- | ------ | ------ |
| `server/socket/meetingSocket.js`    | Meeting WS auth     | Clerk token/session | 5     | Critical | bridge | L      |
| `server/socket/transcriptSocket.js` | Transcript WS       | Same                | 5     | Critical | bridge | L      |
| `server/socket/documentSync.js`     | Collab `/sync`      | Same                | 5     | Critical | bridge | L      |
| `server/config/socket.js`           | Socket registration | Wire auth helper    | 5     | High     | above  | S      |

---

## Backend — calendar / slack / exports (identity coupling only)

| File                                         | Purpose                 | Reason                                                      | Phase | Risk | Deps            | Effort |
| -------------------------------------------- | ----------------------- | ----------------------------------------------------------- | ----- | ---- | --------------- | ------ |
| `server/routes/calendarRoutes.js`            | Calendar OAuth          | Use Clerk-authenticated userId in `state`; harden callbacks | 5     | High | userAuth bridge | M      |
| `server/controllers/slackController.js`      | Slack install state JWT | Still needs Mongo userId from bridge                        | 5     | Med  | userAuth        | S      |
| `server/jobs/exportDataJob.js`               | Export tokens           | Keep JWT; ensure userId from Mongo                          | 5–7   | Low  | —               | S      |
| `server/controllers/sharedLinkController.js` | Shared access JWT       | Keep; regression only                                       | 5–7   | Low  | —               | S      |

---

## Backend — route modules (import middleware only)

All of these use `userAuth` today. Change = import bridge / ensure dual works. **Phase 2** (wire once) + spot checks **Phase 5–7**.

`authRoutes`, `userRoutes`, `organizationRoutes`, `membershipRoutes`, `membershipRequestRoutes`, `invitationRoutes`, `meetingRoutes`, `searchRoutes`, `aiRoutes`, `policyRoutes`, `analyticsRoutes`, `geminiRoutes`, `notificationRoutes`, `knowledgeRoutes`, `calendarRoutes`, `policyComplianceRoutes`, `sessionRoutes`, `assistantRoutes`, `transcriptRoutes`, `sharedLinkRoutes`, `meetingTemplateRoutes`, `bookmarkRoutes`, `commentRoutes`, `activityRoutes`, `tagRoutes`, `pollRoutes`, `webhookRoutes` (mgmt), `slackRoutes` (`/install`).

| Aggregate              | Phase | Risk | Effort         |
| ---------------------- | ----- | ---- | -------------- |
| Middleware import swap | 2     | Med  | M (mechanical) |

**Also fix (verified bug, not Clerk-specific):**  
`server/controllers/activityController.js` uses `req.user.currentOrganization` — should use `organization`. Schedule Phase 4 or earlier bugfix. Risk Med.

---

## Frontend

| File                                                      | Purpose              | Reason                                   | Phase | Risk     | Deps       | Effort |
| --------------------------------------------------------- | -------------------- | ---------------------------------------- | ----- | -------- | ---------- | ------ |
| `client/src/main.jsx`                                     | App bootstrap        | ClerkProvider                            | 3     | High     | keys       | S      |
| `client/src/context/AppContext.jsx`                       | Auth state           | Dual bootstrap                           | 3     | Critical | `/api/me`  | L      |
| `client/src/services/apiClient.js`                        | HTTP client          | Dual CSRF vs Clerk token                 | 3, 7  | Critical | flag       | L      |
| `client/src/services/csrfService.js`                      | CSRF                 | Keep until 7; delete 8                   | 3, 8  | Med      | —          | S      |
| `client/src/services/authApi.js`                          | Legacy auth API      | Dual then remove                         | 3, 8  | Med      | —          | S      |
| `client/src/components/ProtectedRoute.jsx`                | Guards               | Clerk session aware                      | 3     | High     | AppContext | M      |
| `client/src/routes/PublicRoutes.jsx`                      | Public routes        | Clerk sign-in routes                     | 3     | Med      | —          | S      |
| `client/src/routes/ProtectedRoutes.jsx`                   | Protected map        | Unchanged mostly                         | 3     | Low      | —          | S      |
| `client/src/pages/Login.jsx`                              | Legacy login         | Flagged replacement                      | 3, 8  | High     | Clerk      | M      |
| `client/src/pages/EmailVerify.jsx`                        | OTP UI               | Retire                                   | 7–8   | Low      | —          | S      |
| `client/src/pages/ResetPassword.jsx`                      | Reset UI             | Retire                                   | 7–8   | Low      | —          | S      |
| `client/src/components/Navbar.jsx`                        | Chrome / logout      | Clerk UserButton; fix CSRF clear         | 3     | Med      | —          | M      |
| `client/src/pages/Settings.jsx`                           | Security settings    | Remove password; fix Bearer legacy       | 3–5   | Med      | —          | M      |
| `client/src/pages/Profile.jsx`                            | Profile              | Verification badge semantics             | 3–4   | Low      | —          | S      |
| `client/src/hooks/useWebRTC.js`                           | WebRTC               | `withCredentials` / Clerk socket auth    | 5     | Critical | sockets    | M      |
| `client/src/pages/AiAssistant.jsx`                        | Legacy Bearer        | Standardize apiClient                    | 5     | Med      | —          | S      |
| `client/src/pages/TranscriptViewer.jsx`                   | Cookie parse Bearer  | Standardize                              | 5     | Med      | —          | S      |
| `client/src/pages/CreateMeeting/.../AvailabilityGrid.jsx` | Legacy Bearer        | Standardize                              | 5     | Med      | —          | S      |
| `client/src/pages/Calendar.jsx`                           | Calendar connect URL | Works with Clerk session cookies/headers | 5     | Med      | —          | S      |
| `client/src/components/CalendarIntegrations.jsx`          | Calendar UI          | Same                                     | 5     | Med      | —          | S      |
| `client/src/pages/CookiePolicy.jsx`                       | Legal copy           | Update cookie inventory                  | 8     | Low      | legal      | S      |
| `client/src/utils/rbacPermissions.js`                     | Client RBAC          | Likely unchanged                         | —     | Low      | —          | —      |

Org pages (`OrganizationHub`, create/join/invite) — **Phase 4** smoke + `getUserData`/`/api/me` refresh. Effort M aggregate.

---

## Tests / CI docs

| File                                               | Phase | Risk | Effort |
| -------------------------------------------------- | ----- | ---- | ------ |
| Auth/CSRF/integration suites                       | 2–8   | High | L      |
| `docs/CI_PIPELINE.md` / CONTRIBUTING auth sections | 1, 8  | Low  | S      |
| New Clerk migration docs (this folder)             | 1     | Low  | —      |

---

## Jobs / workers (regression)

Identity-indirect; verify not broken by express bootstrap changes:

- `server/jobs/calendarSyncJob.js`
- `server/services/calendarSyncService.js` (`initCalendarSyncCron`)
- `server/config/workers.js` / audio/sentiment/export jobs
- `server/jobs/exportDataJob.js` (JWT download tokens)

Phase: **5–7** regression. Risk: Med. Effort: S–M.
