# 🤝 Contributing to MeetOnMemory

Thanks for considering a contribution to **MeetOnMemory**! Every contribution — bug fix, docs, UI, or new feature — helps.

---

## 📚 Table of Contents

1. [Contribution Workflow](#-contribution-workflow)
2. [Issue First Policy](#-issue-first-policy)
3. [Local Setup](#️-local-setup)
4. [Development](#-development)
5. [Validation](#-validation)
6. [Git Workflow](#-git-workflow)
7. [Pull Requests](#-pull-requests)
8. [CI/CD Pipeline](#️-cicd-pipeline)
9. [Troubleshooting](#-troubleshooting)
10. [FAQ](#-faq)

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

Configure `.env` (MongoDB URI, Clerk secret key, JWT secret for shared-link/integration tokens).

```bash
npm run server
```

---

## 🔐 Authentication

- **Clerk** is the sole authentication provider (frontend + backend session verification).
- **MongoDB** remains the source of truth for authorization (RBAC — roles/permissions).
- Secondary **JWTs** are used only for specific features (e.g. shared links, integration tokens) — not for primary auth.
- Legacy login/session-based auth flow has been fully removed; do not reintroduce it.

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

Examples:

```bash
git checkout -b feature/semantic-search
git checkout -b fix/login-validation
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
2. Create/confirm feature branch.
3. Implement changes.
4. Run local validation (root + client/server as applicable).
5. Format code (`npm run format`).
6. Commit and push.
7. Open PR.

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
