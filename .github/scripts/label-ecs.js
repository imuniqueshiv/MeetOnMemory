import { MAINTAINER_ASSOCIATIONS, TIMERS } from "./constants.js";
import { isExpectedRepository, safeCall } from "./helpers.js";
import { readMetadata, updateIssueMetadata } from "./metadata.js";
import { getAuthorPriorityExpiresAt, issueAuthorRole } from "./permissions.js";

/**
 * Automatically applies the 'ECSoC26' label to contributor-created Issues and Pull Requests.
 * Skipping labeling if the author is a maintainer (OWNER, MEMBER, COLLABORATOR).
 * For contributor-created issues, also stamps authorPriorityExpiresAt (48h exclusive window).
 */
export async function autoLabelEcs({ github, context, core }) {
  if (!isExpectedRepository(context)) {
    core.info("Skipping: Action is not running in the expected repository.");
    return;
  }

  const isIssue = context.eventName === "issues";
  const isPR =
    context.eventName === "pull_request" ||
    context.eventName === "pull_request_target";

  if (!isIssue && !isPR) {
    core.info(`Skipping: Unsupported event type "${context.eventName}".`);
    return;
  }

  const payload = context.payload;
  const target = isIssue ? payload.issue : payload.pull_request;

  if (!target) {
    core.warning(
      "Skipping: Target payload (issue or pull_request) is missing.",
    );
    return;
  }

  const author = target.user.login;
  const association = target.author_association;

  core.info(
    `Evaluating creation of #${target.number} by @${author} (association: ${association})`,
  );

  if (isIssue && !MAINTAINER_ASSOCIATIONS.includes(association)) {
    await ensureAuthorPriorityMetadata(github, context, core, target);
  }

  // Exclude maintainers/collaborators with admin/write access
  if (MAINTAINER_ASSOCIATIONS.includes(association)) {
    core.info(
      `Skipping auto-labeling: Author @${author} has maintainer association "${association}".`,
    );
    return;
  }

  // Check if the label 'ECSoC26' is already present
  const labels = target.labels || [];
  const hasLabel = labels.some((l) => l.name === "ECSoC26");

  if (hasLabel) {
    core.info(
      `Skipping: 'ECSoC26' label is already present on #${target.number}.`,
    );
    return;
  }

  // Apply the 'ECSoC26' label
  const issueNumber = target.number;
  core.info(`Applying 'ECSoC26' label to #${issueNumber}...`);

  const result = await safeCall(
    core,
    "issues.addLabels",
    () =>
      github.rest.issues.addLabels({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issueNumber,
        labels: ["ECSoC26"],
      }),
    null,
  );

  if (result) {
    core.info(`Successfully applied 'ECSoC26' label to #${issueNumber}.`);
  } else {
    core.setFailed(`Failed to apply 'ECSoC26' label to #${issueNumber}.`);
  }
}

async function ensureAuthorPriorityMetadata(github, context, core, issue) {
  const metadata = readMetadata(issue.body);
  if (metadata.authorPriorityExpiresAt) return;
  if (
    ["owner", "maintainer", "collaborator"].includes(issueAuthorRole(issue))
  ) {
    return;
  }

  const expiresAt =
    getAuthorPriorityExpiresAt(issue, metadata) ||
    new Date(
      Date.now() + TIMERS.authorPriorityHours * 60 * 60 * 1000,
    ).toISOString();

  await updateIssueMetadata(github, context, core, issue, (draft) => {
    if (!draft.authorPriorityExpiresAt) {
      draft.authorPriorityExpiresAt = expiresAt;
    }
    return draft;
  });
}
