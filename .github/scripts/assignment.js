import { AUTOMATION } from "./constants.js";
import { comments } from "./comments.js";
import {
  createComment,
  findCommentByMarker,
  getIssue,
  isExpectedRepository,
} from "./helpers.js";
import { setAssignmentMetadata, updateIssueMetadata } from "./metadata.js";
import { isMaintainerRole, resolveActorRole } from "./permissions.js";
import { isIgnoredBotUser } from "./utils.js";

export async function processManualAssignment({ github, context, core }) {
  if (!isExpectedRepository(context)) return;
  if (context.eventName !== "issues" || context.payload.action !== "assigned")
    return;
  if (context.payload.issue?.pull_request) return;
  if (isIgnoredBotUser(context.payload.sender)) return;
  const assigner = context.payload.sender?.login;
  const assignerRole = await resolveActorRole(github, context, core, assigner);
  if (!isMaintainerRole(assignerRole)) return;

  const issueNumber = context.payload.issue.number;
  const assignedUser = context.payload.assignee?.login;
  if (!assignedUser) return;

  const issue = await getIssue(github, context, core, issueNumber);
  if (!issue) return;

  // Persist manualAssignment so expiration/reminders never touch this claim.
  await updateIssueMetadata(github, context, core, issue, (draft) =>
    setAssignmentMetadata(draft, "manual"),
  );

  const existingWelcome = await findCommentByMarker(
    github,
    context,
    core,
    issueNumber,
    AUTOMATION.assignmentWelcomeMarker,
  );
  if (existingWelcome) return;

  await createComment(
    github,
    context,
    core,
    issueNumber,
    comments.manualAssignmentWelcome({ assignee: assignedUser, issueNumber }),
  );
}
