# Automated PR Validation (CI Check Review)

To catch failing checks earlier and reduce repetitive maintainer reviews, this repository implements an automated workflow that inspects a Pull Request's required GitHub Checks and automatically requests changes when they fail.

## How It Works

1. **Trigger Event**:
   - The workflow is triggered whenever a **Check Suite** completes (`check_suite.completed`), i.e. after GitHub Actions check suites finish on a PR's latest commit.
   - CI jobs are **path-filtered**. Required check names that were skipped (path filter) still appear as completed check runs with conclusion `skipped`; the bot treats those as non-failures and only requests changes when a required check concludes with `failure`.

2. **Required Checks**:
   - Only the following checks are treated as required: `Code Quality`, `Backend Validation`, `Frontend Validation`, `Integration Tests`.
   - `Security Checks` is informational only (it never fails the build) and is ignored by this automation.

3. **On Failure**:
   - The bot inspects the failed check runs, builds a contributor-friendly summary with links to the failed workflow logs, and submits a **Request Changes** review mentioning the PR author.

4. **On Recovery**:
   - If a later commit makes all required checks pass, the bot automatically dismisses its previous "Request Changes" review and posts a confirmation comment. No new "Request Changes" review is created once everything passes.

5. **Idempotence**:
   - The bot looks for its own previous review (identified by an internal marker) before acting, so it never posts duplicate "Request Changes" reviews for the same failure state.

6. **Maintainer Overrides**:
   - This automation never blocks maintainers — a maintainer can still approve or merge a PR regardless of the bot's review state.

## Out of Scope

This automation does not auto-merge PRs, auto-fix code, assign reviewers, or manage labels/issue assignment.

## Implementation Details

- **Workflow File**: `.github/workflows/11-ci-validation.yml`
- **Execution Script**: `.github/scripts/ci-validation.js`
- **Permissions Required**: `pull-requests: write`, `contents: read`, `checks: read`
