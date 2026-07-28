import { comments } from "./comments.js";
import {
  createComment,
  dismissReview,
  findReviewByMarker,
  isExpectedRepository,
  requestChangesReview,
  safeCall,
  summarizeRequiredCheckStates,
} from "./helpers.js";
import { hasMarker } from "./utils.js";
import { AUTOMATION, REQUIRED_CHECK_NAMES } from "./constants.js";

async function findOpenPullRequestForSha(github, context, core, sha) {
  const result = await safeCall(
    core,
    "repos.listPullRequestsAssociatedWithCommit",
    () =>
      github.rest.repos.listPullRequestsAssociatedWithCommit({
        owner: context.repo.owner,
        repo: context.repo.repo,
        commit_sha: sha,
      }),
    { data: [] },
  );
  const prs = result?.data || [];
  return prs.find((pr) => pr.state === "open") || null;
}

export async function processCiValidation({ github, context, core }) {
  if (!isExpectedRepository(context)) return;
  if (context.eventName !== "check_suite") return;

  const action = context.payload.action;
  if (action !== "completed") return;

  const checkSuite = context.payload.check_suite;
  if (!checkSuite) return;

  const sha = checkSuite.head_sha;
  const pr =
    checkSuite.pull_requests?.[0] ||
    (await findOpenPullRequestForSha(github, context, core, sha));
  if (!pr) return;

  const prNumber = pr.number;
  const prAuthor = pr.user?.login;
  if (!prAuthor) return;

  const checkRunsResponse = await safeCall(
    core,
    "checks.listForRef",
    () =>
      github.rest.checks.listForRef({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: sha,
        per_page: 100,
      }),
    { data: { check_runs: [] } },
  );
  const checkRuns = checkRunsResponse?.data?.check_runs || [];
  const summary = summarizeRequiredCheckStates(checkRuns, REQUIRED_CHECK_NAMES);

  // Wait until every required check has finished running before judging the PR.
  if (!summary.allCompleted) return;

  const existingReview = await findReviewByMarker(
    github,
    context,
    core,
    prNumber,
    AUTOMATION.ciValidationMarker,
  );

  if (summary.failedCount > 0) {
    // Avoid posting a duplicate active review for the same failure state.
    if (existingReview && existingReview.state === "CHANGES_REQUESTED") return;

    await requestChangesReview(
      github,
      context,
      core,
      prNumber,
      comments.ciValidationFailed({
        user: prAuthor,
        failedRuns: summary.failedRuns,
      }),
    );
    return;
  }

  // All required checks passed — clear any previous automated "Request Changes" review.
  if (existingReview && existingReview.state === "CHANGES_REQUESTED") {
    await dismissReview(
      github,
      context,
      core,
      prNumber,
      existingReview.id,
      "All required checks are now passing.",
    );
    await createComment(
      github,
      context,
      core,
      prNumber,
      comments.ciValidationRecovered({ user: prAuthor }),
    );
  }
}
