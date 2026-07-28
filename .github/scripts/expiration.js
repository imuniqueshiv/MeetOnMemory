import { TIMERS, reminderMarker } from "./constants.js";
import { syncActivityFromOpenPullRequests } from "./activity.js";
import { comments } from "./comments.js";
import {
  createComment,
  getIssue,
  hasOpenLinkedPullRequest,
  listComments,
  listOpenAssignedIssues,
  removeAssignee,
} from "./helpers.js";
import {
  clearAssignmentMetadata,
  isManualAssignment,
  readMetadata,
  resetReminderTracking,
  touchAssigneeActivity,
  updateIssueMetadata,
} from "./metadata.js";
import { hasMarker, hoursSince, isIgnoredBotUser, nowIso } from "./utils.js";

function isAssigneeProgressComment(comment, assignee) {
  if (!comment || comment.user?.login !== assignee) return false;
  if (isIgnoredBotUser(comment.user)) return false;
  // Any non-empty assignee comment counts as meaningful activity.
  return String(comment.body || "").trim().length > 0;
}

export async function processClaimExpiration({ github, context, core }) {
  const issues = await listOpenAssignedIssues(github, context, core);
  const linkedPrCache = new Map();

  for (const issueSummary of issues) {
    const issue = await getIssue(github, context, core, issueSummary.number);
    if (!issue || issue.state !== "open" || issue.locked) continue;
    const assignee = issue.assignees?.[0]?.login;
    if (!assignee) continue;

    let metadata = readMetadata(issue.body);

    // Maintainer manual assignments are never expired or reminded by the bot.
    if (isManualAssignment(metadata)) continue;

    // Freeze while ANY linked PR is still open (including drafts).
    const openLinked = await hasOpenLinkedPullRequest(
      github,
      context,
      core,
      issue.number,
      linkedPrCache,
    );
    if (openLinked) {
      await syncActivityFromOpenPullRequests(
        github,
        context,
        core,
        issue,
        assignee,
        linkedPrCache,
      );
      continue;
    }

    const issueComments = await listComments(
      github,
      context,
      core,
      issue.number,
    );

    const lastSignal = issueComments
      .filter((c) => isAssigneeProgressComment(c, assignee))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    if (lastSignal) {
      const signalTime = lastSignal.created_at;
      if (
        !metadata.lastActivityAt ||
        new Date(signalTime) > new Date(metadata.lastActivityAt)
      ) {
        await updateIssueMetadata(github, context, core, issue, (draft) => {
          touchAssigneeActivity(draft, signalTime);
          return draft;
        });
      }
    }

    const freshIssue = await getIssue(github, context, core, issue.number);
    if (!freshIssue) continue;
    const freshMeta = readMetadata(freshIssue.body);
    if (isManualAssignment(freshMeta)) continue;

    const baseline =
      freshMeta.lastActivityAt || freshMeta.assignedAt || freshIssue.updated_at;
    const inactiveHours = hoursSince(baseline);

    if (inactiveHours >= TIMERS.expirationHours) {
      await removeAssignee(github, context, core, issue.number, assignee);
      await createComment(
        github,
        context,
        core,
        issue.number,
        comments.expiration({ assignee }),
      );
      await updateIssueMetadata(github, context, core, freshIssue, (draft) =>
        clearAssignmentMetadata(draft),
      );
      continue;
    }

    // Highest due reminder first; at most one reminder comment per run.
    const reminderHoursDesc = [...TIMERS.reminderHours].sort((a, b) => b - a);
    const remindersSentAt = freshMeta.remindersSentAt || {};
    for (const hours of reminderHoursDesc) {
      const key = String(hours);
      const marker = reminderMarker(hours);
      if (
        inactiveHours >= hours &&
        !remindersSentAt[key] &&
        !issueComments.some((c) => hasMarker(c.body, marker))
      ) {
        await createComment(
          github,
          context,
          core,
          issue.number,
          comments.reminder({ assignee, hours }),
        );
        await updateIssueMetadata(
          github,
          context,
          core,
          freshIssue,
          (draft) => {
            draft.remindersSentAt = {
              ...(draft.remindersSentAt || {}),
              [key]: nowIso(),
            };
            return draft;
          },
        );
        break;
      }
    }
  }
}

// Re-export for tests that may spy on reminder reset behavior.
export { resetReminderTracking };
