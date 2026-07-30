import { ISSUE_EVENTS } from "./constants.js";
import { getIssue, isExpectedRepository } from "./helpers.js";
import {
  clearAssignmentMetadata,
  resetReminderTracking,
  updateIssueMetadata,
} from "./metadata.js";

export async function processIssueLifecycle({ github, context, core }) {
  if (!isExpectedRepository(context)) return;
  if (!["issues", "issue_comment"].includes(context.eventName)) return;
  if (context.payload.issue?.pull_request) return;

  const action = context.payload.action;
  const issueNumber = context.payload.issue.number;
  const issue = await getIssue(github, context, core, issueNumber);
  if (!issue) return;

  if (context.eventName === "issue_comment" && action === "deleted") {
    const actor = context.payload.comment?.user?.login;
    await updateIssueMetadata(github, context, core, issue, (draft) => {
      const guidance = draft.guidance || {};
      for (const key of Object.keys(guidance)) {
        if (actor && key.startsWith(`${actor}:`)) delete guidance[key];
      }
      draft.guidance = guidance;
      return draft;
    });
    return;
  }

  if (
    [
      ISSUE_EVENTS.closed,
      ISSUE_EVENTS.unassigned,
      ISSUE_EVENTS.transferred,
    ].includes(action)
  ) {
    await updateIssueMetadata(github, context, core, issue, (draft) =>
      clearAssignmentMetadata(draft),
    );
    return;
  }

  if (action === ISSUE_EVENTS.reopened) {
    await updateIssueMetadata(github, context, core, issue, (draft) => {
      resetReminderTracking(draft);
      draft.expiredAt = null;
      draft.lastActivityAt = new Date().toISOString();
      return draft;
    });
  }
}
