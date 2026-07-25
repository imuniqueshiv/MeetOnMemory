import { TIMERS } from "./constants.js";
import { comments } from "./comments.js";
import {
  createComment,
  getIssue,
  listComments,
  listOpenAssignedIssues,
  removeAssignee,
} from "./helpers.js";
import {
  clearAssignmentMetadata,
  readMetadata,
  updateIssueMetadata,
} from "./metadata.js";
import { isActivitySignal } from "./regex.js";
import { hasMarker, hoursSince, nowIso } from "./utils.js";

function hasLinkedPrActivity(commentsList, assignee) {
  return commentsList.some((comment) => {
    if (comment.user?.login !== assignee) return false;
    return /#\d+|pull request|pr/i.test(comment.body || "");
  });
}

export async function processClaimExpiration({ github, context, core }) {
  const issues = await listOpenAssignedIssues(github, context, core);
  for (const issueSummary of issues) {
    const issue = await getIssue(github, context, core, issueSummary.number);
    if (!issue || issue.state !== "open" || issue.locked) continue;
    const assignee = issue.assignees?.[0]?.login;
    if (!assignee) continue;

    const metadata = readMetadata(issue.body);
    const issueComments = await listComments(
      github,
      context,
      core,
      issue.number,
    );

    const lastSignal = issueComments
      .filter((c) => c.user?.login === assignee)
      .filter(
        (c) => isActivitySignal(c.body) || hasLinkedPrActivity([c], assignee),
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    if (lastSignal) {
      const signalTime = lastSignal.created_at;
      if (
        !metadata.lastActivityAt ||
        new Date(signalTime) > new Date(metadata.lastActivityAt)
      ) {
        await updateIssueMetadata(github, context, core, issue, (draft) => {
          draft.lastActivityAt = signalTime;
          draft.reminder8SentAt = null;
          draft.reminder16SentAt = null;
          draft.reminder24SentAt = null;
          draft.reminder32SentAt = null;
          draft.reminder40SentAt = null;
          return draft;
        });
      }
    }

    const freshIssue = await getIssue(github, context, core, issue.number);
    if (!freshIssue) continue;
    const freshMeta = readMetadata(freshIssue.body);
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
        comments.expiration48h({ assignee }),
      );
      await updateIssueMetadata(github, context, core, freshIssue, (draft) =>
        clearAssignmentMetadata(draft),
      );
      continue;
    }

    if (
      inactiveHours >= TIMERS.reminder40Hours &&
      !freshMeta.reminder40SentAt &&
      !issueComments.some((c) => hasMarker(c.body, "mom:reminder-40h"))
    ) {
      await createComment(
        github,
        context,
        core,
        issue.number,
        comments.reminder40h({ assignee }),
      );
      await updateIssueMetadata(github, context, core, freshIssue, (draft) => {
        draft.reminder40SentAt = nowIso();
        return draft;
      });
      continue;
    }

    if (
      inactiveHours >= TIMERS.reminder32Hours &&
      !freshMeta.reminder32SentAt &&
      !issueComments.some((c) => hasMarker(c.body, "mom:reminder-32h"))
    ) {
      await createComment(
        github,
        context,
        core,
        issue.number,
        comments.reminder32h({ assignee }),
      );
      await updateIssueMetadata(github, context, core, freshIssue, (draft) => {
        draft.reminder32SentAt = nowIso();
        return draft;
      });
      continue;
    }

    if (
      inactiveHours >= TIMERS.reminder24Hours &&
      !freshMeta.reminder24SentAt &&
      !issueComments.some((c) => hasMarker(c.body, "mom:reminder-24h"))
    ) {
      await createComment(
        github,
        context,
        core,
        issue.number,
        comments.reminder24h({ assignee }),
      );
      await updateIssueMetadata(github, context, core, freshIssue, (draft) => {
        draft.reminder24SentAt = nowIso();
        return draft;
      });
      continue;
    }

    if (
      inactiveHours >= TIMERS.reminder16Hours &&
      !freshMeta.reminder16SentAt &&
      !issueComments.some((c) => hasMarker(c.body, "mom:reminder-16h"))
    ) {
      await createComment(
        github,
        context,
        core,
        issue.number,
        comments.reminder16h({ assignee }),
      );
      await updateIssueMetadata(github, context, core, freshIssue, (draft) => {
        draft.reminder16SentAt = nowIso();
        return draft;
      });
      continue;
    }

    if (
      inactiveHours >= TIMERS.reminder8Hours &&
      !freshMeta.reminder8SentAt &&
      !issueComments.some((c) => hasMarker(c.body, "mom:reminder-8h"))
    ) {
      await createComment(
        github,
        context,
        core,
        issue.number,
        comments.reminder8h({ assignee }),
      );
      await updateIssueMetadata(github, context, core, freshIssue, (draft) => {
        draft.reminder8SentAt = nowIso();
        return draft;
      });
    }
  }
}
