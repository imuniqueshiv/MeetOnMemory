import { comments } from "./comments.js";
import {
  createComment,
  createOrUpdateMarkerComment,
  findCommentByMarker,
  getIssue,
  isExpectedRepository,
  safeCall,
  summarizeCheckStates,
} from "./helpers.js";
import { processPrActivityRefresh } from "./activity.js";
import { extractLinkedIssueNumbers, hasMarker } from "./utils.js";
import { AUTOMATION } from "./constants.js";

function isMeaningfulDescription(text) {
  const value = String(text || "").trim();
  return value.length >= 20;
}

function checklistLine(label, ok, detail = "") {
  return `- [${ok ? "x" : " "}] ${label}${detail ? ` - ${detail}` : ""}`;
}

export async function processPrValidation({ github, context, core }) {
  if (!isExpectedRepository(context)) return;
  if (context.eventName !== "pull_request_target") return;

  const action = context.payload.action;
  const allowed = [
    "opened",
    "edited",
    "synchronize",
    "reopened",
    "ready_for_review",
  ];
  if (!allowed.includes(action)) return;

  const pr = context.payload.pull_request;
  if (!pr) return;

  if (action === "opened") {
    const existingWelcomeComment = await findCommentByMarker(
      github,
      context,
      core,
      pr.number,
      AUTOMATION.prOpenedMarker,
    );

    if (!existingWelcomeComment) {
      await createComment(
        github,
        context,
        core,
        pr.number,
        comments.prOpened({
          user: pr.user.login,
        }),
      );
    }
  }

  // Refresh assignee inactivity timers for linked issues (drafts included).
  await processPrActivityRefresh({ github, context, core });

  const prNumber = pr.number;
  const body = pr.body || "";
  const linkedIssues = extractLinkedIssueNumbers(body);
  const lines = [];

  lines.push(checklistLine("Linked issue provided", linkedIssues.length > 0));
  lines.push(
    checklistLine("PR description present", isMeaningfulDescription(body)),
  );
  lines.push(
    checklistLine(
      "Branch naming valid",
      /^((feature|fix|docs|chore|refactor)\/)[a-z0-9._-]+$/i.test(pr.head.ref),
      `branch: ${pr.head.ref}`,
    ),
  );
  lines.push(
    checklistLine(
      "Checklist reviewed",
      /\-\s\[[xX ]\]/.test(body),
      "complete relevant items in PR template",
    ),
  );
  lines.push(checklistLine("Screenshots", true, "optional unless UI changed"));

  if (pr.draft) {
    lines.push(
      checklistLine(
        "Draft PR mode",
        true,
        "full validation deferred until ready for review",
      ),
    );
  } else {
    for (const issueNumber of linkedIssues) {
      const issue = await getIssue(github, context, core, issueNumber);
      if (!issue) {
        lines.push(checklistLine(`Issue #${issueNumber} exists`, false));
        continue;
      }
      lines.push(
        checklistLine(`Issue #${issueNumber} open`, issue.state === "open"),
      );
      const assignee = issue.assignees?.[0]?.login || null;
      if (assignee && assignee !== pr.user.login) {
        lines.push(
          checklistLine(
            `Issue #${issueNumber} assigned contributor`,
            false,
            `assigned to @${assignee}`,
          ),
        );
        lines.push(
          checklistLine(
            "Assignment policy",
            false,
            comments.missingAssignment({ issueNumber, assignee }),
          ),
        );
      } else {
        lines.push(
          checklistLine(`Issue #${issueNumber} assigned contributor`, true),
        );
      }
    }
  }

  const checkRunsResponse = await safeCall(
    core,
    "checks.listForRef",
    () =>
      github.rest.checks.listForRef({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: pr.head.sha,
      }),
    { data: { check_runs: [] } },
  );
  const checkSummary = summarizeCheckStates(
    checkRunsResponse?.data?.check_runs || [],
  );
  lines.push(
    checklistLine(
      "Build and lint status",
      checkSummary.failedCount === 0,
      checkSummary.failedCount
        ? `failing checks: ${checkSummary.failedNames.join(", ")}`
        : checkSummary.pendingCount
          ? "checks pending"
          : "all reported checks passing",
    ),
  );

  const summary = comments.prValidationSummary({
    lines: {
      author: pr.user.login,
      items: lines,
    },
    missingLinkedIssueText:
      linkedIssues.length === 0 ? comments.missingLinkedIssue() : "",
    missingDescriptionText: !isMeaningfulDescription(body)
      ? `\n${comments.missingPrDescription()}`
      : "",
  });
  await createOrUpdateMarkerComment(
    github,
    context,
    core,
    prNumber,
    AUTOMATION.prChecklistMarker,
    comments.prValidationChecklist({ body: summary }),
  );
}

export async function processPrMerged({ github, context, core }) {
  if (!isExpectedRepository(context)) return;
  if (context.eventName !== "pull_request_target") return;
  if (context.payload.action !== "closed") return;

  const pr = context.payload.pull_request;
  if (!pr?.merged) return;

  const linkedIssues = extractLinkedIssueNumbers(pr.body || "");
  const existingMergedComment = await findCommentByMarker(
    github,
    context,
    core,
    pr.number,
    AUTOMATION.mergedMarker,
  );

  const linkedIssueRecords = [];
  for (const issueNumber of linkedIssues) {
    const issue = await getIssue(github, context, core, issueNumber);
    linkedIssueRecords.push({ issueNumber, issue });
  }
  const issueDescriptions = linkedIssueRecords.map(({ issueNumber, issue }) =>
    issue ? `#${issueNumber} (${issue.title})` : `#${issueNumber}`,
  );
  const issuesText =
    linkedIssues.length > 0
      ? `Related issue${linkedIssues.length > 1 ? "s" : ""}: ${issueDescriptions.join(", ")}.`
      : "No linked issue detected in the PR description.";

  if (!existingMergedComment) {
    await createComment(
      github,
      context,
      core,
      pr.number,
      comments.prMergedCongratulations({
        user: pr.user.login,
        prNumber: pr.number,
        prTitle: pr.title || "Untitled PR",
        issuesText,
      }),
    );
  }

  for (const { issueNumber, issue } of linkedIssueRecords) {
    if (!issue || issue.state !== "open") continue;

    await safeCall(core, "issues.update(close)", () =>
      github.rest.issues.update({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: issueNumber,
        state: "closed",
      }),
    );
  }
}

export async function processFirstContributorWelcome({
  github,
  context,
  core,
}) {
  if (!isExpectedRepository(context)) return;
  const action = context.payload.action;
  if (!["opened", "reopened", "ready_for_review"].includes(action)) return;

  const pr = context.payload.pull_request;
  if (!pr) return;
  if (
    !["FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER"].includes(pr.author_association)
  )
    return;

  const existing = await safeCall(
    core,
    "issues.listComments(for first contributor)",
    () =>
      github.paginate(github.rest.issues.listComments, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: pr.number,
        per_page: 100,
      }),
    [],
  );
  if (
    (existing || []).some((comment) =>
      hasMarker(comment.body, AUTOMATION.firstWelcomeMarker),
    )
  )
    return;

  await createComment(
    github,
    context,
    core,
    pr.number,
    comments.firstContributorWelcome({ user: pr.user.login }),
  );
}
