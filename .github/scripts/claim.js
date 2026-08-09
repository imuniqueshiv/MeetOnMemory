import { COMMANDS, LIMITS } from "./constants.js";
import { comments } from "./comments.js";
import {
  addAssignee,
  createComment,
  getIssue,
  isExpectedRepository,
  isIssueUnavailable,
  listOpenAssignedIssuesForUser,
  logInfo,
  removeAssignee,
} from "./helpers.js";
import {
  clearAssignmentMetadata,
  readMetadata,
  setAssignmentMetadata,
  updateIssueMetadata,
  isManualAssignment,
} from "./metadata.js";
import {
  canAutoClaimIssue,
  canUnclaim,
  resolveActorRole,
} from "./permissions.js";
import { isCommand, isIgnoredBotUser, normalizeCommentBody } from "./utils.js";

export async function processClaim({ github, context, core }) {
  if (!isExpectedRepository(context)) return;
  if (
    context.eventName !== "issue_comment" ||
    context.payload.action !== "created"
  )
    return;
  if (context.payload.issue?.pull_request) return;

  const comment = context.payload.comment;
  const actor = comment?.user?.login;
  if (!isCommand(comment?.body, COMMANDS.claim)) return;
  if (isIgnoredBotUser(comment?.user)) return;

  const issueNumber = context.payload.issue.number;
  const issue = await getIssue(github, context, core, issueNumber);
  if (isIssueUnavailable(issue, context, core)) {
    await createComment(
      github,
      context,
      core,
      issueNumber,
      comments.issueUnavailable({ user: actor }),
    );
    return;
  }

  const metadata = issue ? readMetadata(issue.body) : null;
  const commentId = comment?.id;
  if (
    metadata &&
    commentId &&
    metadata.processedClaimCommentIds?.includes(commentId)
  )
    return;

  const actorRole = await resolveActorRole(github, context, core, actor);

  const assignees = issue.assignees || [];
  const currentAssignee = assignees[0]?.login || null;
  if (currentAssignee === actor) return;
  if (currentAssignee && currentAssignee !== actor) {
    await createComment(
      github,
      context,
      core,
      issueNumber,
      comments.alreadyAssigned({ assignee: currentAssignee }),
    );
    return;
  }

  if (!canAutoClaimIssue(issue, actor, metadata || {})) {
    await createComment(
      github,
      context,
      core,
      issueNumber,
      comments.wrongIssueAuthorClaimAttempt({
        user: actor,
        issueAuthor: issue.user?.login || "the issue author",
      }),
    );
    return;
  }

  const activeIssues = await listOpenAssignedIssuesForUser(
    github,
    context,
    core,
    actor,
  );
  if (
    !["owner", "maintainer", "collaborator"].includes(actorRole) &&
    activeIssues.length >= LIMITS.maxActiveAssignedIssues
  ) {
    await createComment(
      github,
      context,
      core,
      issueNumber,
      comments.maxIssueLimitReached({
        user: actor,
        activeCount: activeIssues.length,
      }),
    );
    return;
  }

  const finalIssue = await getIssue(github, context, core, issueNumber);
  const finalAssignee = finalIssue?.assignees?.[0]?.login;
  if (finalAssignee) {
    await createComment(
      github,
      context,
      core,
      issueNumber,
      comments.alreadyAssigned({ assignee: finalAssignee }),
    );
    return;
  }

  const assigned = await addAssignee(github, context, core, issueNumber, actor);
  if (!assigned) return;

  const refreshedIssue = await getIssue(github, context, core, issueNumber);
  if (refreshedIssue) {
    await updateIssueMetadata(
      github,
      context,
      core,
      refreshedIssue,
      (metadataDraft) => {
        const next = setAssignmentMetadata(metadataDraft, "claim");
        next.processedClaimCommentIds = [
          ...(next.processedClaimCommentIds || []),
          commentId,
        ].slice(-20);
        return next;
      },
    );
  }

  await createComment(
    github,
    context,
    core,
    issueNumber,
    comments.successfulClaim({ user: actor, issueNumber }),
  );
  logInfo(core, "claim accepted", { issueNumber, actor });
}

export async function processUnclaim({ github, context, core }) {
  if (!isExpectedRepository(context)) return;
  if (
    context.eventName !== "issue_comment" ||
    context.payload.action !== "created"
  )
    return;
  if (context.payload.issue?.pull_request) return;

  const comment = context.payload.comment;
  const actor = comment?.user?.login;
  if (!isCommand(comment?.body, COMMANDS.unclaim)) return;
  if (isIgnoredBotUser(comment?.user)) return;

  const issueNumber = context.payload.issue.number;
  const issue = await getIssue(github, context, core, issueNumber);
  if (!issue) return;
  const metadata = readMetadata(issue.body);
  const commentId = comment?.id;
  if (commentId && metadata.processedUnclaimCommentIds?.includes(commentId))
    return;

  const assignees = issue.assignees || [];
  if (assignees.length === 0) {
    await createComment(
      github,
      context,
      core,
      issueNumber,
      comments.noActiveClaimToRelease({ user: actor }),
    );
    return;
  }

  const currentAssignee = assignees[0].login;
  const role = await resolveActorRole(github, context, core, actor);
  if (!canUnclaim(actor, role, currentAssignee, metadata)) {
    await createComment(
      github,
      context,
      core,
      issueNumber,
      isManualAssignment(metadata)
        ? comments.manualAssignmentProtected({
            actor,
            assignee: currentAssignee,
          })
        : comments.unauthorizedUnclaim({
            actor,
            assignee: currentAssignee,
          }),
    );
    return;
  }

  const removed = await removeAssignee(
    github,
    context,
    core,
    issueNumber,
    currentAssignee,
  );
  if (!removed) return;

  const refreshedIssue = await getIssue(github, context, core, issueNumber);
  if (refreshedIssue) {
    await updateIssueMetadata(
      github,
      context,
      core,
      refreshedIssue,
      (metadataDraft) => {
        const next = clearAssignmentMetadata(metadataDraft);
        next.processedUnclaimCommentIds = [
          ...(next.processedUnclaimCommentIds || []),
          commentId,
        ].slice(-20);
        return next;
      },
    );
  }

  await createComment(
    github,
    context,
    core,
    issueNumber,
    comments.successfulUnclaim({ assignee: currentAssignee }),
  );

  if (actor !== currentAssignee) {
    await createComment(
      github,
      context,
      core,
      issueNumber,
      comments.maintainerOverrideNotification({
        actor,
        target: currentAssignee,
      }),
    );
  }
}

export function isClaimLikeComment(body) {
  const normalized = normalizeCommentBody(body);
  return normalized.startsWith("/");
}
