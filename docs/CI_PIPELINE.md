# CI Pipeline Documentation

This document describes the Continuous Integration (CI) pipeline for **MeetOnMemory**. Pushes to `main`/`master` and Pull Requests trigger path-filtered jobs so docs-only changes do not run the full matrix.

## Pipeline Architecture

A **Detect Changes** job selects which parallel jobs to run. Each selected job fails independently so contributors get precise feedback.

```
┌──────────────────────────────────────────────────────────────┐
│                   CI Pipeline (GitHub Actions)               │
│                                                              │
│   Triggered on: push to main/master, pull_request            │
│   Path filters: client/**, server/**, lockfiles, docs, …   │
│                                                              │
│   ┌─────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│   │ Code Quality │  │ Backend          │  │ Frontend      │  │
│   │              │  │ Validation       │  │ Validation    │  │
│   │ • Prettier   │  │                  │  │               │  │
│   │   (changed)  │  │ • npm ci         │  │ • npm ci      │  │
│   │              │  │ • ESLint         │  │ • ESLint      │  │
│   │              │  │ • Jest + cov.    │  │ • Vitest      │  │
│   │              │  │ • Startup check  │  │ • Prod build  │  │
│   └─────────────┘  └──────────────────┘  └───────────────┘  │
│                                                              │
│   ┌──────────────────┐  ┌─────────────────────────────────┐  │
│   │ Security Checks  │  │ Integration Tests               │  │
│   │ (informational)  │  │                                 │  │
│   │ • npm audit      │  │ • Auth / health / org / meeting │  │
│   │   server+client  │  │ • Dedicated required-check job  │  │
│   └──────────────────┘  └─────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Job Details

### 0. Detect Changes

Uses `dorny/paths-filter` to set outputs: `backend`, `frontend`, `formatting`, `security`.  
Changing any file under `.github/workflows/**` enables all relevant jobs.

### 1. Code Quality

**Purpose:** Enforce consistent formatting on changed files.

| Check      | Scope              | Tool     |
| ---------- | ------------------ | -------- |
| Formatting | Changed files only | Prettier |

ESLint is **not** duplicated here. Server and client lint run in Backend / Frontend Validation.

### 2. Backend Validation

**Purpose:** Verify the server lints, passes all tests, and can start without crashes.

| Step                   | What it does                                                            |
| ---------------------- | ----------------------------------------------------------------------- |
| `npm ci`               | Clean install of server dependencies                                    |
| `npm run lint`         | ESLint checks (`eslint .`)                                              |
| `npm run test:ci`      | All Jest suites with `--ci --coverage` (includes `integration.test.js`) |
| `npm run test:startup` | Validates module imports, service initialization, and queue wrappers    |

Coverage reports are uploaded as GitHub Actions artifacts (retained for 14 days).  
Runs when `server/**` (or `.github/workflows/**`) changes.

### 3. Frontend Validation

**Purpose:** Ensure the client lints, passes tests, and produces a deployable build.

| Step              | What it does                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `npm ci`          | Clean install of client dependencies                                                           |
| `npm run lint`    | ESLint checks (`eslint .`)                                                                     |
| `npm run test:ci` | Runs all Vitest test suites in single-run mode                                                 |
| `npm run build`   | Full Vite production build — catches import errors, missing modules, and TypeScript/JSX issues |

Runs when `client/**` (or `.github/workflows/**`) changes.

### 4. Security Checks

**Purpose:** Surface known vulnerabilities in dependencies (**informational**).

| Step               | Threshold            |
| ------------------ | -------------------- |
| Server `npm audit` | `--audit-level=high` |
| Client `npm audit` | `--audit-level=high` |

This job uses `|| true` so advisory findings do **not** fail the workflow. The PR automation in `11-ci-validation` ignores this check.  
Runs when **server or client** `package.json` / `package-lock.json` (or `.github/workflows/**`) change. Root manifests are not audited by this job.

### 5. Integration Tests

**Purpose:** Dedicated parallel signal for critical API endpoints (`supertest` + MongoMemoryServer).

**Note:** The same file (`server/tests/integration.test.js`) is also collected by Backend Validation `test:ci`. The separate job is retained as an isolated check name for contributor feedback. See “Future: Integration Tests migration” below.

Runs when `server/**` (or `.github/workflows/**`) changes.

---

## Separate Workflows

These workflows run independently from the main CI pipeline:

| Workflow                 | File               | Trigger                                          |
| ------------------------ | ------------------ | ------------------------------------------------ |
| CodeQL Security Analysis | `codeql.yml`       | Push to main, path-filtered PRs, weekly schedule |
| Keep-Alive Health Check  | `health-check.yml` | Every 15 min (cron)                              |
| PR Validation            | `05-pr-check.yml`  | PR events                                        |

---

## Future: Integration Tests migration (not implemented)

Removing the dedicated Integration Tests job is a **medium-risk** change. Do **not** implement until:

1. Confirm GitHub branch protection does not list `Integration Tests` (currently: no required status checks).
2. Update `.github/scripts/constants.js` `REQUIRED_CHECK_NAMES` to drop `"Integration Tests"`.
3. Update `docs/ci-validation-automation.md`.
4. Rely on Backend Validation `test:ci` (already runs `integration.test.js` — verified via `jest --listTests`).
5. Monitor one release cycle for contributor confusion about the missing named check.

Until then, keep both for the isolated parallel signal.

---

## Running Checks Locally

### Server

```bash
cd server

# Lint
npm run lint

# Full test suite
npm test

# Tests with coverage (mirrors CI)
npm run test:ci

# Startup validation
npm run test:startup

# Single integration test file
node --experimental-vm-modules node_modules/jest/bin/jest.js --forceExit tests/integration.test.js
```

### Client

```bash
cd client

# Lint
npm run lint

# Tests (watch mode)
npm test

# Tests (single run, mirrors CI)
npm run test:ci

# Production build
npm run build
```

### Formatting

```bash
# From repo root
npm run format:check    # Check only
npm run format          # Auto-fix
```

### Security

```bash
# Advisory output is informational in CI (`|| true`).
cd server && npm audit --audit-level=high || true
cd client && npm audit --audit-level=high || true
```

---

## Adding New Tests

### Backend (Jest)

1. Create a file in `server/tests/` with the `.test.js` extension.
2. Import `{ app }` from `../server.js` for supertest-based API tests.
3. The shared `setup.js` automatically provides MongoMemoryServer.
4. Tests using Vitest should be added to the Jest ignore list in `server/jest.config.js`.

### Frontend (Vitest)

1. Create a file with `.test.js` or `.test.jsx` extension.
2. Place it alongside the component or in a `__tests__/` directory.
3. Use `@testing-library/react` for component testing.
4. Configuration is in `client/vite.config.js` under `test`.

### Integration Tests

1. Add new `describe` blocks to `server/tests/integration.test.js`.
2. Use the `registerAndLogin()` helper for authenticated requests.
3. Use `createCsrfAgent()` for unauthenticated + CSRF scenarios.

---

## Troubleshooting

### Common CI Failures

| Issue                              | Fix                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Prettier formatting error          | Run `npm run format` from the repo root                                                                 |
| ESLint error (server)              | Run `npm run lint --prefix server` locally and fix warnings/errors                                      |
| ESLint error (client)              | Run `npm run lint --prefix client` locally and fix warnings/errors                                      |
| Test timeout                       | Increase `testTimeout` in `server/jest.config.js` (default: 30s)                                        |
| MongoMemoryServer download failure | Check network access; the binary is cached after first download                                         |
| Build failure (client)             | Run `npm run build --prefix client` locally to see the exact error                                      |
| Job skipped unexpectedly           | Path filters skipped it — change `server/**`, `client/**`, or `.github/workflows/**` to force that side |

### Worker process force-exit warnings

The warning _"A worker process has failed to exit gracefully"_ is caused by open handles (timers, connections) in some test suites. The `--forceExit` flag ensures Jest exits cleanly. Use `--detectOpenHandles` locally to identify and fix leaks.
