import { COMMANDS } from "./constants.js";
import {
  getIssue,
  hasOpenLinkedPullRequest,
  isExpectedRepository,
  listOpenLinkedPullRequests,
} from "./helpers.js";
import {
  isManualAssignment,
  readMetadata,
  touchAssigneeActivity,
  updateIssueMetadata,
} from "./metadata.js";
import {
  extractLinkedIssueNumbers,
  isCommand,
  isIgnoredBotUser,
  nowIso,
} from "./utils.js";

/**
 * Persist activity refresh for an assigned issue when the actor is the assignee.
 * Skips bots and non-assignees. Manual assignments are left untouched (never expire).
 */
export async function refreshIssueActivity({
  github,
  context,
  core,
  issue,
  actor,
  at = nowIso(),
}) {
  if (!issue || issue.state !== "open" || issue.locked) return false;
  if (!actor || isIgnoredBotUser({ login: actor })) return false;

  const assignee = issue.assignees?.[0]?.login;
  if (!assignee || assignee !== actor) return false;

  const metadata = readMetadata(issue.body);
  if (isManualAssignment(metadata)) return false;

  const probe = touchAssigneeActivity({ ...metadata }, at);
  if (!probe.changed) return false;

  await updateIssueMetadata(github, context, core, issue, (draft) => {
    touchAssigneeActivity(draft, at);
    return draft;
  });
  return true;
}

/**
 * PR-driven activity: when the PR author (or review actor) is the assignee
 * of a linked issue, refresh lastActivityAt.
 */
export async function processPrActivityRefresh({ github, context, core }) {
  if (!isExpectedRepository(context)) return;

  const targetPr =
    context.payload.pull_request || context.payload.pull_request_target || null;
  if (!targetPr) return;

  const actor =
    context.payload.sender?.login ||
    context.payload.comment?.user?.login ||
    context.payload.review?.user?.login ||
    targetPr.user?.login;

  if (isIgnoredBotUser(context.payload.sender || { login: actor })) return;

  const linkedIssues = extractLinkedIssueNumbers(
    `${targetPr.title || ""}\n${targetPr.body || ""}`,
  );
  if (linkedIssues.length === 0) return;

  const activityAt =
    targetPr.updated_at ||
    context.payload.review?.submitted_at ||
    context.payload.comment?.created_at ||
    nowIso();

  for (const issueNumber of linkedIssues) {
    const issue = await getIssue(github, context, core, issueNumber);
    if (!issue) continue;
    await refreshIssueActivity({
      github,
      context,
      core,
      issue,
      actor,
      at: activityAt,
    });
  }
}

/**
 * Issue-comment activity from the assignee (non-command comments).
 */
export async function processIssueCommentActivity({ github, context, core }) {
  if (!isExpectedRepository(context)) return;
  if (context.eventName !== "issue_comment") return;
  if (context.payload.action !== "created") return;
  if (context.payload.issue?.pull_request) return;

  const comment = context.payload.comment;
  const actor = comment?.user?.login;
  if (!actor || isIgnoredBotUser(comment?.user)) return;
  if (isCommand(comment?.body, COMMANDS.claim)) return;
  if (isCommand(comment?.body, COMMANDS.unclaim)) return;

  const issueNumber = context.payload.issue.number;
  const issue = await getIssue(github, context, core, issueNumber);
  if (!issue) return;

  await refreshIssueActivity({
    github,
    context,
    core,
    issue,
    actor,
    at: comment.created_at || nowIso(),
  });
}

/**
 * During expiration: sync lastActivityAt from the newest open linked PR update.
 */
export async function syncActivityFromOpenPullRequests(
  github,
  context,
  core,
  issue,
  assignee,
  cache = null,
) {
  const linked = await listOpenLinkedPullRequests(
    github,
    context,
    core,
    issue.number,
    cache,
  );
  if (linked.length === 0) return false;

  let newest = null;
  for (const pr of linked) {
    const stamp = pr.updated_at || pr.created_at;
    if (!stamp) continue;
    if (!newest || new Date(stamp) > new Date(newest)) newest = stamp;
  }
  if (!newest) return false;

  return refreshIssueActivity({
    github,
    context,
    core,
    issue,
    actor: assignee,
    at: newest,
  });
}

export { hasOpenLinkedPullRequest };
