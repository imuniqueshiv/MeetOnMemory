import { EXPECTED_REPOSITORY } from "./constants.js";
import {
  extractLinkedIssueNumbers,
  formatError,
  hasMarker,
  logError,
  logInfo,
  logWarning,
} from "./utils.js";

export function getRepoFromContext(context) {
  return `${context.repo.owner}/${context.repo.repo}`;
}

export function isExpectedRepository(context) {
  if (!EXPECTED_REPOSITORY) return true;
  return (
    getRepoFromContext(context).toLowerCase() ===
    EXPECTED_REPOSITORY.toLowerCase()
  );
}

export async function safeCall(core, operationName, fn, fallback = null) {
  try {
    return await fn();
  } catch (error) {
    logError(core, `${operationName} failed`, error);
    return fallback;
  }
}

export async function getIssue(github, context, core, issueNumber) {
  const result = await safeCall(
    core,
    "issues.get",
    () =>
      github.rest.issues.get({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issueNumber,
      }),
    null,
  );
  return result?.data || null;
}

export async function createComment(github, context, core, issueNumber, body) {
  return safeCall(
    core,
    "issues.createComment",
    () =>
      github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issueNumber,
        body,
      }),
    null,
  );
}

export async function listComments(github, context, core, issueNumber) {
  const comments = await safeCall(
    core,
    "issues.listComments",
    () =>
      github.paginate(github.rest.issues.listComments, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issueNumber,
        per_page: 100,
      }),
    [],
  );
  return comments || [];
}

export async function findCommentByMarker(
  github,
  context,
  core,
  issueNumber,
  marker,
) {
  const comments = await listComments(github, context, core, issueNumber);
  return comments.find((comment) => hasMarker(comment.body, marker)) || null;
}

export async function createOrUpdateMarkerComment(
  github,
  context,
  core,
  issueNumber,
  marker,
  body,
) {
  const existing = await findCommentByMarker(
    github,
    context,
    core,
    issueNumber,
    marker,
  );
  if (!existing) return createComment(github, context, core, issueNumber, body);
  return safeCall(
    core,
    "issues.updateComment",
    () =>
      github.rest.issues.updateComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: existing.id,
        body,
      }),
    null,
  );
}

export async function addAssignee(
  github,
  context,
  core,
  issueNumber,
  assignee,
) {
  return safeCall(
    core,
    "issues.addAssignees",
    () =>
      github.rest.issues.addAssignees({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issueNumber,
        assignees: [assignee],
      }),
    null,
  );
}

export async function removeAssignee(
  github,
  context,
  core,
  issueNumber,
  assignee,
) {
  return safeCall(
    core,
    "issues.removeAssignees",
    () =>
      github.rest.issues.removeAssignees({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issueNumber,
        assignees: [assignee],
      }),
    null,
  );
}

export async function listOpenAssignedIssuesForUser(
  github,
  context,
  core,
  username,
) {
  const records = await safeCall(
    core,
    "issues.listForRepo",
    () =>
      github.paginate(github.rest.issues.listForRepo, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        state: "open",
        assignee: username,
        per_page: 100,
      }),
    [],
  );
  return (records || []).filter((item) => !item.pull_request);
}

export async function listOpenAssignedIssues(github, context, core) {
  const records = await safeCall(
    core,
    "issues.listForRepo(open)",
    () =>
      github.paginate(github.rest.issues.listForRepo, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        state: "open",
        per_page: 100,
      }),
    [],
  );
  return (records || []).filter(
    (item) => !item.pull_request && (item.assignees || []).length > 0,
  );
}

/**
 * Find OPEN PRs (including drafts) that link to the given issue number.
 * Uses a scoped search + body/title parse to avoid listing every PR.
 * Results are suitable for expiration freeze (any open linked PR freezes).
 */
export async function listOpenLinkedPullRequests(
  github,
  context,
  core,
  issueNumber,
  cache = null,
) {
  const key = String(issueNumber);
  if (cache && cache.has(key)) return cache.get(key);

  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const q = `repo:${owner}/${repo} is:pr is:open ${issueNumber} in:body,title`;
  const items = await safeCall(
    core,
    "search.issuesAndPullRequests(linked open PRs)",
    () =>
      github.paginate(github.rest.search.issuesAndPullRequests, {
        q,
        per_page: 30,
      }),
    [],
  );

  const linked = (items || []).filter((pr) => {
    const isPr =
      Boolean(pr.pull_request) || String(pr.html_url || "").includes("/pull/");
    if (!isPr) return false;
    const numbers = extractLinkedIssueNumbers(
      `${pr.title || ""}\n${pr.body || ""}`,
    );
    return numbers.includes(Number(issueNumber));
  });

  if (cache) cache.set(key, linked);
  return linked;
}

export async function hasOpenLinkedPullRequest(
  github,
  context,
  core,
  issueNumber,
  cache = null,
) {
  const linked = await listOpenLinkedPullRequests(
    github,
    context,
    core,
    issueNumber,
    cache,
  );
  return linked.length > 0;
}

export async function getCollaboratorPermission(
  github,
  context,
  core,
  username,
) {
  const result = await safeCall(
    core,
    "repos.getCollaboratorPermissionLevel",
    () =>
      github.rest.repos.getCollaboratorPermissionLevel({
        owner: context.repo.owner,
        repo: context.repo.repo,
        username,
      }),
    null,
  );
  return result?.data?.permission || "none";
}

export function isIssueUnavailable(issue, context, core) {
  if (!issue) return true;
  if (issue.state !== "open") return true;
  if (issue.locked) return true;
  if (context.payload?.repository?.archived) return true;
  return false;
}

export function summarizeRequiredCheckStates(
  checkRuns = [],
  requiredNames = [],
) {
  const requiredRuns = checkRuns.filter((c) => requiredNames.includes(c.name));
  const failed = requiredRuns.filter(
    (c) => c.status === "completed" && c.conclusion === "failure",
  );
  const pending = requiredRuns.filter((c) => c.status !== "completed");
  const allCompleted = requiredRuns.length > 0 && pending.length === 0;
  return {
    total: requiredRuns.length,
    failedCount: failed.length,
    pendingCount: pending.length,
    allCompleted,
    failedRuns: failed,
  };
}

export function summarizeCheckStates(checkRuns = []) {
  const failed = checkRuns.filter(
    (c) => c.status === "completed" && c.conclusion === "failure",
  );
  const pending = checkRuns.filter((c) => c.status !== "completed");
  return {
    failedCount: failed.length,
    pendingCount: pending.length,
    failedNames: failed.map((c) => c.name),
  };
}

export async function listReviews(github, context, core, prNumber) {
  const reviews = await safeCall(
    core,
    "pulls.listReviews",
    () =>
      github.paginate(github.rest.pulls.listReviews, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: prNumber,
        per_page: 100,
      }),
    [],
  );
  return reviews || [];
}

export async function findReviewByMarker(
  github,
  context,
  core,
  prNumber,
  marker,
) {
  const reviews = await listReviews(github, context, core, prNumber);
  return (
    reviews.find(
      (review) => review.user?.type === "Bot" && hasMarker(review.body, marker),
    ) || null
  );
}

export async function requestChangesReview(
  github,
  context,
  core,
  prNumber,
  body,
) {
  return safeCall(
    core,
    "pulls.createReview(REQUEST_CHANGES)",
    () =>
      github.rest.pulls.createReview({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: prNumber,
        event: "REQUEST_CHANGES",
        body,
      }),
    null,
  );
}

export async function dismissReview(
  github,
  context,
  core,
  prNumber,
  reviewId,
  message,
) {
  return safeCall(
    core,
    "pulls.dismissReview",
    () =>
      github.rest.pulls.dismissReview({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: prNumber,
        review_id: reviewId,
        message,
      }),
    null,
  );
}

export { logInfo, logWarning, logError, formatError };
