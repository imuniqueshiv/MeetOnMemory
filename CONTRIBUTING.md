# 🤝 Contributing to MeetOnMemory

Thanks for considering a contribution to **MeetOnMemory**! Every contribution — bug fix, docs, UI, or new feature — helps.

---

## 📚 Table of Contents

1. [Contribution Workflow](#-contribution-workflow)
2. [Issue First Policy](#-issue-first-policy)
3. [GitHub Actions Bot & Automation Rules](#-github-actions-bot--automation-rules)
4. [Local Setup](#️-local-setup)
5. [Development](#-development)
6. [Validation](#-validation)
7. [Git Workflow](#-git-workflow)
8. [Pull Requests](#-pull-requests)
9. [CI/CD Pipeline](#️-cicd-pipeline)
10. [Troubleshooting](#-troubleshooting)
11. [FAQ](#-faq)

---

## 🔁 Contribution Workflow

1. 🍴 Fork the repository.
2. 📥 Clone your fork.
3. 🔗 Add the upstream remote.
4. 🔄 Sync with upstream `main`.
5. 📌 Claim an issue (`/claim`) and wait for assignment.
6. 🌿 Create a feature branch.
7. 💻 Implement only the assigned issue.
8. 🧪 Run local validation.
9. 📦 Commit and push.
10. 🔁 Open a Pull Request.

```bash
git clone https://github.com/YOUR_USERNAME/MeetOnMemory.git
cd MeetOnMemory

git remote add upstream https://github.com/imuniqueshiv/MeetOnMemory.git
git fetch upstream
git merge upstream/main
```

---

## 📌 Issue First Policy

- Search existing issues first.
- If one exists, comment `/claim` and wait for assignment.
- If none exists, open one and wait for maintainer approval before coding.
- To release an issue you can't finish, comment `/unclaim`.

See [GitHub Actions Bot & Automation Rules](#-github-actions-bot--automation-rules) for claim limits, assignment timers, and automated reminders.

### ✅ Do

- Claim before starting work.
- Keep one PR scoped to one issue.
- Follow existing project structure.
- Test changes locally before pushing.

### ❌ Don't

- Work on an unclaimed issue.
- Bundle unrelated changes in one PR.
- Rename project/branding/package names without explicit issue/maintainer approval.
- Submit unreviewed AI-generated code.
- Force-push after review without explanation.

---

## 🤖 GitHub Actions Bot & Automation Rules

MeetOnMemory uses a GitHub Actions bot to manage issue claims, assignment timers, PR validation, and contributor reminders. The rules below reflect **current automated behavior** — follow them to avoid losing a claim or having a PR closed automatically.

### Quick reference

| Rule                               | Current behavior                             |
| ---------------------------------- | -------------------------------------------- |
| Maximum active claims              | **5** (a 6th claim is rejected)              |
| Issue assignment window (`/claim`) | **24 hours** of inactivity before expiration |
| Author-priority window             | **24 hours** for contributor-opened issues   |
| Inactivity reminders (`/claim`)    | **6h**, **12h**, **18h** after last activity |
| Stale PR threshold                 | **More than 48 hours** open (strict `>48h`)  |
| Stale PR action                    | Automatically **closed** (never merged)      |
| Manual maintainer assignments      | **Not** expired or reminded by the bot       |

---

### Issue claiming (`/claim` and `/unclaim`)

#### How to claim

1. Find an open, unassigned issue.
2. Comment exactly:

   ```text
   /claim
   ```

   The command must match exactly — no extra text.

3. Wait for the bot to assign the issue to you and confirm with a welcome comment.

#### How to unclaim

If you can no longer work on an issue, comment exactly:

```text
/unclaim
```

The issue is released for other contributors.

#### Maximum active claims

- You may have up to **5 open assigned issues** at the same time.
- Your **5th** active claim is allowed.
- A **6th** active claim is **rejected** — complete or `/unclaim` one of your current issues first.
- Repository **owners, maintainers, and collaborators** are not subject to this limit.

#### Other claim restrictions

- **Already assigned:** If someone else is assigned, `/claim` is rejected.
- **Duplicate claim:** If you are already assigned, `/claim` is ignored.
- **Unavailable issues:** Closed, locked, or archived issues cannot be claimed.
- **Author priority (contributor-opened issues):** When a contributor opens an issue, the author has an exclusive **24-hour** window to claim it (active through 23:59:59; expired at 24:00:00). After that window ends, anyone may `/claim`. If the issue is still unclaimed at 24 hours, the bot notifies the author once. Maintainer-opened issues are not subject to this window.
- **Manual assignments:** If a maintainer assigns you directly, `/claim` is not used. Only a **maintainer** can `/unclaim` or reassign a manual assignment — the assignee cannot release it with `/unclaim`.

---

### Issue assignment and expiration

These rules apply to issues claimed through the automated **`/claim`** flow. **Manual maintainer assignments are excluded** — the bot does not expire or send inactivity reminders for those.

#### 24-hour activity window

After a successful `/claim`:

- A **24-hour inactivity window** begins, tracked from your last recorded activity on that issue.
- You are expected to open a PR or leave progress on the issue within this window (the bot welcome message reflects this).
- If there is **no qualifying activity for 24 hours**, the bot:
  1. Removes you as assignee.
  2. Posts an expiration comment on the issue.
  3. Clears assignment tracking metadata so the issue can be claimed again.

#### What counts as activity

Activity **resets the 24-hour timer** and **clears pending inactivity reminders** for that issue when:

- **You comment on the assigned issue** (any non-empty comment that is not a bot comment).
- **You push or update a linked open PR** (including draft PRs) that references the issue in its title or body — for example `Closes #123`.

While **any open linked PR** exists for the issue (including a **draft**), assignment expiration and inactivity reminders are **paused** until that PR is closed.

#### Inactivity reminder schedule

If you remain inactive after `/claim`, the bot sends **at most one reminder per scheduled run** at these thresholds:

| Elapsed inactive time | Reminder                                        |
| --------------------- | ----------------------------------------------- |
| 6 hours               | First check-in                                  |
| 12 hours              | Second check-in                                 |
| 18 hours              | Third check-in                                  |
| 24 hours              | Assignment expires (not a reminder — see above) |

Reminders are **not** sent before 6 hours, **not** sent after expiration, and **not** repeated for the same threshold once already sent.

#### Assignment lifecycle (automated `/claim`)

```text
Issue claimed (/claim)
      ↓
Activity window begins (24h)
      ↓
No qualifying activity
      ↓
6h reminder
      ↓
12h reminder
      ↓
18h reminder
      ↓
24h → assignment expires, issue released
```

Qualifying activity at any point resets the timer and reminder tracking (unless expiration is frozen by an open linked PR).

---

### Pull request automation

#### Stale PR auto-close (>48 hours)

The bot runs on an hourly schedule and evaluates **open** pull requests.

| PR age (from `created_at`) | Bot action                     |
| -------------------------- | ------------------------------ |
| 48 hours exactly           | **Not** auto-closed            |
| More than 48 hours         | Eligible for automatic closure |

When a PR exceeds **48 hours** open:

- The bot **closes** the PR. It does **not** merge it.
- After a successful close, the bot posts an explanatory comment on the PR.
- To continue, address any required changes or check failures and **reopen the PR or open a new one** following this guide.

This applies based on when the PR was **opened** (`created_at`), not last commit or review activity.

#### Changes-requested reminders

On the same hourly schedule (for PRs not stale-closed), the bot may remind you when:

- The **latest relevant human review** on the PR is **`CHANGES_REQUESTED`**.
- Automated **bot/CI validation reviews** are excluded from this reminder logic.
- If a maintainer **approves** after an earlier changes-requested review, a stale reminder is **not** continued for the old request.
- The bot updates a single reminder comment to avoid spamming you each hour.

The bot does **not** close or merge a PR merely because changes were requested.

#### Failed CI / pipeline reminders

The bot also checks **required CI checks** on the PR's **current head commit** (`head.sha`).

Required check names (as configured in automation):

- **Code Quality**
- **Backend Validation**
- **Frontend Validation**
- **Integration Tests**

Reminder behavior:

- **Pending or incomplete** required checks → **no** failed-pipeline reminder.
- **All required checks completed** and **at least one failed** → the bot posts or updates a reminder comment listing failed checks.
- The bot uses its existing comment update mechanism to avoid duplicate spam on each hourly run.

Separately, when a check suite completes, **CI validation automation** may submit an automated **“Request changes”** review when required checks fail, and dismiss that review when all required checks pass. Fix failing checks before expecting maintainer review.

Failed-check reminders apply to **non-draft** PRs. Draft PRs are skipped for review/check reminders but can still be subject to stale auto-close if open more than 48 hours.

---

### PR validation checklist (on open/update)

When you open or update a PR, the bot posts or updates a **PR Review Checklist** comment validating:

| Check              | Requirement                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Linked issue       | At least one issue referenced in the PR body (e.g. `Closes #123`)                                                                  |
| PR description     | Meaningful description (minimum ~20 characters)                                                                                    |
| Branch naming      | Prefix must be one of: `feature/`, `fix/`, `docs/`, `chore/`, `refactor/` followed by lowercase letters, numbers, `.`, `_`, or `-` |
| Checklist          | PR template checklist items reviewed                                                                                               |
| Issue assignment   | Linked issue should be assigned to you (or coordinate with the assignee)                                                           |
| Required CI checks | Status of the required checks listed above                                                                                         |

**Draft PRs:** Full linked-issue and assignment validation in the checklist is deferred until the PR is marked ready for review, but opening a draft PR still counts as activity for linked issue claims.

#### Other PR automation

- **Welcome on open:** The bot welcomes new PR authors and links to Discord.
- **First-time contributors:** First-time contributors receive an additional welcome message (once per PR).
- **Activity refresh:** PR synchronize/edit/reopen events refresh linked issue activity timers for the assignee.
- **On merge:** When a maintainer merges your PR, the bot congratulates you and closes linked issues referenced in the PR body.

---

### Contributor responsibilities

#### When you claim an issue

- Start working promptly within the **24-hour** window.
- Leave progress comments or open a (draft) PR to keep your claim active.
- Respond to bot check-in reminders at 6h, 12h, and 18h.
- Use `/unclaim` if you cannot continue.
- Do not exceed **5** active assigned issues at once.

#### When you open a PR

- Link the appropriate issue (`Closes #...`).
- Follow the PR template and write a clear description.
- Use an allowed branch prefix (`feature/`, `fix/`, `docs/`, `chore/`, `refactor/`).
- Address **changes requested** by reviewers promptly.
- Fix **failed required checks** before expecting approval.
- Do not leave a PR unattended for **more than 48 hours** — it may be closed automatically.

---

## ⚙️ Local Setup

### Root

```bash
npm install
```

Set up environment variables (root `.env` — see `.env.example` if present).

### Client

```bash
cd client
npm install
```

Configure Clerk keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) in `client/.env`.

```bash
npm run dev
```

### Server

```bash
cd server
npm install
```

Configure `.env` (MongoDB URI, Clerk secret key, JWT secret, SHARED_LINK_JWT_SECRET for shared-link tokens).

```bash
npm run server
```

---

## 🔐 Authentication

- **Clerk** is the sole authentication provider (frontend + backend session verification).
- **MongoDB** remains the source of truth for authorization (RBAC — roles/permissions).
- Secondary **JWTs** are used only for specific features (e.g. shared links, integration tokens) — not for primary auth.
- Legacy login/session-based auth flow has been fully removed; do not reintroduce it.

For detailed setup, environment variables, local testing, and user synchronization instructions, please refer to the [Authentication Contributor Runbook](docs/AUTH_CONTRIBUTOR_RUNBOOK.md).

---

## ✨ Development

### Coding Standards

**Frontend**

- Functional components only.
- Small, reusable components.
- Follow existing folder structure.

**Backend**

- Keep controllers modular.
- Validate all request data.
- Handle errors consistently.
- Follow existing API structure.

**General**

- Meaningful variable names, no dead code.
- Avoid unnecessary complexity.
- One feature/bug per PR.

### Commit Messages

```bash
git commit -m "feat: add semantic search filters"
git commit -m "fix: resolve login validation issue"
git commit -m "docs: update README"
git commit -m "refactor: simplify meeting controller"
```

Prefixes: `feat`, `fix`, `docs`, `refactor`, `style`, `test`, `chore`

---

## 🧪 Validation

Husky + lint-staged auto-run ESLint/Prettier on staged files at commit time; a failing check aborts the commit.

### Root-level checks

```bash
npm run lint
npm run build
npx prettier . --check
```

### Frontend (`client/`)

```bash
npm run format:check:changed --prefix client
npm run lint:changed --prefix client
npm run test:related --prefix client
npm run validate:pr --prefix client
```

Frontend build (required if `client/**` changed):

```bash
npm run build --prefix client
```

### Backend (`server/`)

```bash
npm run format:check:changed --prefix server
npm run lint:changed --prefix server
npm run test:related --prefix server
npm run validate:pr --prefix server
```

Server has no build step.

### Git

```bash
git diff --check
```

### Auto-format

```bash
npm run format
```

### ☑️ Pre-Push Checklist

- [ ] Formatting passes
- [ ] Linting passes
- [ ] Build passes (if `client/**` changed)
- [ ] Related tests pass
- [ ] `git diff --check` clean
- [ ] Branch synced with upstream `main`

---

## 🌿 Git Workflow

```bash
git checkout -b feature/your-feature-name
```

Examples (must use an allowed prefix — see [GitHub Actions Bot & Automation Rules](#-github-actions-bot--automation-rules)):

```bash
git checkout -b feature/semantic-search
git checkout -b fix/login-validation
git checkout -b docs/update-contributing
```

Common commands:

```bash
git fetch upstream
git merge upstream/main
git checkout -b feature/issue-name
git push -u origin feature/issue-name
```

---

## 🚀 Pull Requests

1. Sync fork with upstream `main`.
2. Create/confirm feature branch (allowed prefixes: `feature/`, `fix/`, `docs/`, `chore/`, `refactor/`).
3. Implement changes.
4. Run local validation (root + client/server as applicable).
5. Format code (`npm run format`).
6. Commit and push.
7. Open PR — link the issue (`Closes #...`) and ensure the assigned issue matches your work.

The bot validates PRs automatically and posts a checklist comment. See [GitHub Actions Bot & Automation Rules](#-github-actions-bot--automation-rules) for timers, required checks, and auto-close rules.

```bash
git add .
git commit -m "feat: improve semantic search"
git push origin feature/semantic-search
```

### ✅ PR Checklist

- [ ] Linked issue (`Closes #...`)
- [ ] Issue was assigned before work started
- [ ] Screenshots included (for UI changes)
- [ ] Root validation passed (`lint`, `build`, `prettier . --check`)
- [ ] Client/server `format:check:changed`, `lint:changed`, `test:related`, `validate:pr` passed (as applicable)
- [ ] Frontend build passes (if `client/**` changed)
- [ ] `git diff --check` clean
- [ ] Documentation updated (if required)
- [ ] No unnecessary files included
- [ ] No merge conflicts
- [ ] PR addresses exactly one issue
- [ ] Clean commit history
- [ ] Existing functionality not broken

---

## ⚙️ CI/CD Pipeline

GitHub Actions runs path-filtered checks on every PR — not all jobs run on every PR.

| Job                     | Trigger             | Checks                                                                               |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| **Detect Changes**      | Always              | Determines which downstream jobs run based on changed paths                          |
| **Root Prettier**       | Always              | Prettier check on changed root files                                                 |
| **Frontend Validation** | `client/**` changed | ESLint (changed files), Prettier (changed files), production build (`npm run build`) |
| **Server Validation**   | `server/**` changed | ESLint (changed files), Prettier (changed files)                                     |

### ❌ Not run on every PR

Backend tests, frontend tests, integration tests, startup tests, security audits, CodeQL — these run in separate scheduled/post-merge workflows, not on PR checks.

---

## 🐛 Troubleshooting

**Frontend Validation fails**

```bash
cd client
npm run lint:changed
npm run format:check:changed
npm run build
```

**Server Validation fails**

```bash
cd server
npm run lint:changed
npm run format:check:changed
```

**Root Prettier fails**

```bash
npx prettier . --check
npm run format
```

**Build failures**

- Reproduce locally with `npm run build --prefix client`.
- Check for missing env vars (Clerk keys) or type errors.

**Formatting/Lint failures**

- Run `npm run format` at root, or the changed-file variants above, before committing.

---

## ❓ FAQ

**Q: Do I need to run backend/frontend tests before opening a PR?**
Not required for CI (they don't run on PRs), but `test:related` is recommended to catch regressions early.

**Q: My PR only touches `server/`, do I need to run client checks?**
No — CI only runs Frontend Validation when `client/**` changes, and vice versa for Server Validation.

**Q: How do I keep my branch up to date?**

```bash
git fetch upstream
git merge upstream/main
```

**Q: How many issues can I claim at once?**
Up to **5** active assigned issues. Use `/unclaim` to release one before claiming another if you are at the limit.

**Q: What happens if I don't update my claimed issue?**
After **6h**, **12h**, and **18h** of inactivity the bot sends reminders. After **24 hours** without qualifying activity, the claim expires and the issue is released. Opening a linked PR or commenting on the issue resets the timer.

**Q: Will my PR be closed automatically?**
If a PR stays open for **more than 48 hours** (based on when it was opened), the bot closes it without merging. Reopen or open a new PR after addressing feedback and checks.

**Q: Where do I ask questions?**
Open a Discussion, open an Issue, or join Discord: https://discord.gg/c29cwdVMG

---

## 🐞 Reporting Bugs

Include: steps to reproduce, expected behavior, actual behavior, screenshots (if applicable), browser/OS info.

## 💡 Feature Requests

Include: clear description, use case, expected benefit, possible implementation.

## 🎯 Areas Open for Contribution

AI Search Improvements · Meeting Management · Policy Repository · Reports & Analytics · UI/UX · Accessibility · Documentation · Testing · Performance · Security · Mobile Responsiveness

## 👀 Review Process

Every PR is reviewed by maintainers. You may be asked to fix bugs, improve code quality, resolve comments, update docs, or re-test. Please be patient.

## 📜 Code of Conduct

Be respectful, professional, and welcoming.

---

## ❤️ Thank You

Thanks for contributing to **MeetOnMemory**! Happy coding! 🚀
