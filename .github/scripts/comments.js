import { AUTOMATION, COMMANDS, reminderMarker } from "./constants.js";

import { withMarker } from "./utils.js";

export const comments = {
  successfulClaim: ({ user, issueNumber }) =>
    withMarker(
      AUTOMATION.claimWelcomeMarker,
      `Hi @${user}, thanks so much for volunteering to take this on! 🎉\n\n` +
        `Issue #${issueNumber} is now officially assigned to you. Before you dive in, please take a moment to review **CONTRIBUTING.md**, and try to keep your PR focused on this issue so it's easy to review.\n\n` +
        `⏳ Please open your PR within **48 hours**. If you need a bit more time, no worries — just leave a quick progress update here and you're good to continue.\n\n` +
        `Excited to see what you build. Happy coding! 🚀`,
    ),

  alreadyAssigned: ({ assignee }) =>
    `Thanks so much for checking in! 🙌\n\n` +
    `This issue is currently assigned to @${assignee}, so it's not available to claim right now.\n\n` +
    `No worries though — take a look at our other open, unassigned issues and feel free to claim one that matches your interests. We'd love to have you on board! 💙`,

  maxIssueLimitReached: ({ user, activeCount }) =>
    `Hi @${user}, thanks for your enthusiasm — it does not go unnoticed! 🌟\n\n` +
    `You currently have **${activeCount} active assigned issues**, and our current limit is **4** at a time, just so everyone gets a fair shot at contributing.\n\n` +
    `Please complete or release one of your active issues with \`${COMMANDS.unclaim}\`, and then you're welcome to claim another right away.`,

  invalidClaim: ({ user }) =>
    `Hi @${user}, thanks for wanting to jump in! 😊\n\n` +
    `To claim an issue, please comment exactly \`${COMMANDS.claim}\` (no extra text).\n\n` +
    `If you're new here, **CONTRIBUTING.md** has the full contribution workflow to help you get started smoothly.`,

  wrongIssueAuthorClaimAttempt: ({ user, issueAuthor }) =>
    `Hi @${user}, thank you for your interest in this issue! 🙏\n\n` +
    `This particular issue was opened by @${issueAuthor}. Contributor-opened issues have an exclusive **48-hour** claim window for the author.\n\n` +
    `After that window ends, anyone may claim the issue with \`${COMMANDS.claim}\`. In the meantime, please feel free to browse our other open issues!`,

  manualAssignmentProtected: ({ actor, assignee }) =>
    `Hi @${actor}, thanks for checking in! 😊\n\n` +
    `This issue was assigned by a maintainer to @${assignee}. Only a maintainer can release or reassign it.\n\n` +
    `If you believe this needs attention, please tag a maintainer — thanks!`,

  duplicateClaim: ({ user }) =>
    `Hi @${user}, good news — you already have this issue assigned to you! ✅\n\n` +
    `Feel free to continue your work, and share updates here anytime. We're rooting for you! 💪`,

  successfulUnclaim: ({ assignee }) =>
    `Thanks so much, @${assignee}, for letting us know! 🙏\n\n` +
    `This issue has been released and is now open for other contributors to claim.\n\n` +
    `We really appreciate your honesty, and we'd love to see you back on another issue whenever you're ready!`,

  unauthorizedUnclaim: ({ actor, assignee }) =>
    `Hi @${actor}, thanks for reaching out! 😊\n\n` +
    `Only @${assignee} or a maintainer can use \`${COMMANDS.unclaim}\` on this issue. If you believe this needs attention, feel free to tag a maintainer for help.`,

  noActiveClaimToRelease: ({ user }) =>
    `Hi @${user}, thanks for checking in! 🙂\n\n` +
    `There's no active claim on this issue right now.\n\n` +
    `If you'd like to work on it, just comment \`${COMMANDS.claim}\` and it's yours!`,

  manualAssignmentWelcome: ({ assignee, issueNumber }) =>
    withMarker(
      AUTOMATION.assignmentWelcomeMarker,
      `Hi @${assignee}, welcome aboard! 🎉\n\n` +
        `You are now assigned to issue #${issueNumber}. Please follow **CONTRIBUTING.md**, keep your PR focused on this issue, and aim to open it within **48 hours**.\n\n` +
        `If anything blocks you along the way, just leave a short update here — we're happy to help. Looking forward to your contribution! 🚀`,
    ),

  prOpened: ({ user, prNumber, prTitle }) =>
    `Hi @${user}, thank you so much for opening PR #${prNumber} (**${prTitle}**)! 🎉\n\n` +
    `A quick validation pass is running now. If anything is missing, you'll see it below with clear next steps — nothing to worry about, we're here to help you get it merge-ready. 💙`,

  welcomeMessage: ({ user }) =>
    `Hi @${user}, welcome to **MeetOnMemory**! 🎉\n\n` +
    `We're so glad to have you here. Start with **CONTRIBUTING.md**, and feel free to ask questions in Discussions anytime you need a hand getting started.\n\n` +
    `Excited to see what you'll bring to the project! 💙`,

  reminder: ({ assignee, hours }) =>
    withMarker(
      reminderMarker(hours),
      `Hi @${assignee}, just a friendly check-in! 👋\n\n` +
        `It's been about **${hours} hours** since this issue was assigned to you. If you're actively working on it, that's great — just leave a short progress update or open a draft PR to keep your claim active.\n\n` +
        `No pressure, we just want to keep things moving smoothly for everyone. 😊`,
    ),

  expiration: ({ assignee }) =>
    withMarker(
      AUTOMATION.expiredMarker,
      `Hi @${assignee}, thank you again for your interest in this issue! 🙏\n\n` +
        `Since there was no activity within the **48-hour** claim window, the issue has been released so other contributors can get a chance to work on it.\n\n` +
        `If it's still available and you'd like to continue, you're more than welcome to claim it again — we'd love to see you back! 😊`,
    ),

  prValidationChecklist: ({ body }) =>
    withMarker(AUTOMATION.prChecklistMarker, body),

  prValidationSummary: ({
    lines,
    missingLinkedIssueText,
    missingDescriptionText,
  }) =>
    `Hi @${lines.author}, thank you so much for your PR! 🎉\n\n` +
    `### 📋 PR Review Checklist\n\n${lines.items.join("\n")}\n\n${missingLinkedIssueText}${missingDescriptionText}` +
    `\nWe appreciate the effort you've put in — let us know if you need any help getting this across the finish line! 💪`,

  missingLinkedIssue: () =>
    "🔗 Please link at least one issue in the PR description (for example `Closes #123`). This helps us keep everything organized!\n",

  missingAssignment: ({ issueNumber, assignee }) =>
    `👀 Issue #${issueNumber} is currently assigned to @${assignee}. Please coordinate with the assignee, or feel free to ask a maintainer for an override if needed — we're happy to help sort things out!`,

  missingPrDescription: () =>
    "📝 Please add a clear PR description explaining what changed, why it changed, and how you tested it. A good description makes review so much smoother — thanks for taking the time!",

  issueClosed: ({ user, issueNumber }) =>
    `Hi @${user}, just letting you know issue #${issueNumber} has been closed. Claim reminders and assignment metadata were cleaned up automatically. Thanks for your involvement! 🙏`,

  issueReopened: ({ user, issueNumber }) =>
    `Hi @${user}, heads up — issue #${issueNumber} has been reopened. 🔄\n\n` +
    `Claim tracking has been reset so new activity is tracked correctly. Thanks for your patience!`,

  prMergedCongratulations: ({ user, prNumber, prTitle, issuesText }) =>
    withMarker(
      AUTOMATION.mergedMarker,
      `Hi @${user}, thank you so much for this solid contribution! 🎉🚀\n\n` +
        `Your PR #${prNumber} (**${prTitle}**) has been merged. ✅\n\n` +
        `${issuesText}\n\n` +
        `This update fits nicely into the project and is genuinely appreciated — great work! We'd love to see you contribute again soon. 💙\n\n` +
        `⭐ If you're enjoying **MeetOnMemory**, please consider starring the repository — it really helps us out!`,
    ),

  firstContributorWelcome: ({ user }) =>
    withMarker(
      AUTOMATION.firstWelcomeMarker,
      `Hi @${user}, welcome to **MeetOnMemory**! 🎉\n\n` +
        `It's wonderful to have your very first contribution here — thank you for taking the time! Please start with **CONTRIBUTING.md**, and use Discussions anytime you'd like feedback or help.\n\n` +
        `We're so glad you're here. Here's to many more contributions ahead! 💙`,
    ),

  naturalLanguageClaimGuidance: ({ user }) =>
    `Hi @${user}, thanks so much for your interest in this issue! 😊\n\n` +
    `To claim it, just comment exactly \`${COMMANDS.claim}\`.\n\n` +
    `You can also check out **CONTRIBUTING.md** for the full contribution flow. We're excited to see you get started!`,

  issueAlreadyClaimed: ({ user }) =>
    `Hi @${user}, this issue is already assigned to you! ✅\n\n` +
    `Feel free to continue and share your progress here anytime — we're cheering you on! 💪`,

  issueUnavailable: ({ user }) =>
    `Hi @${user}, thanks for your interest! 🙏\n\n` +
    `Unfortunately, this issue isn't available to claim right now (it may be closed, locked, or archived).\n\n` +
    `No worries — there are plenty of other great issues open. Take a look and find one that suits you!`,

  maintainerOverrideNotification: ({ actor, target }) =>
    withMarker(
      AUTOMATION.overrideMarker,
      `🔧 Maintainer update by @${actor}: assignment state was adjusted for @${target}.`,
    ),

  ciValidationFailed: ({ user, failedRuns }) =>
    withMarker(
      AUTOMATION.ciValidationMarker,
      `### ❌ Automated PR Validation Failed\n\n` +
        `Hi @${user},\n\n` +
        `Your Pull Request cannot be reviewed yet because one or more required checks have failed.\n\n` +
        `**Failed Checks**\n\n` +
        failedRuns
          .map(
            (run) =>
              `- ❌ [${run.name}](${run.html_url || run.details_url || "#"})`,
          )
          .join("\n") +
        `\n\nPlease review the workflow logs above, resolve the reported issues, and push a new commit. The checks will run again automatically.\n\n` +
        `Once all required checks pass, the Pull Request will be ready for maintainer review.\n\n` +
        `Thank you for your contribution! 🚀`,
    ),

  ciValidationRecovered: ({ user }) =>
    withMarker(
      AUTOMATION.ciValidationMarker,
      `### ✅ Automated PR Validation Passed\n\n` +
        `Hi @${user}, all required checks are now passing. The earlier automated "Request Changes" review has been dismissed, and this PR is ready for maintainer review. Thanks for the fix! 🎉`,
    ),
};
