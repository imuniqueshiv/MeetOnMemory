export const AUTOMATION = Object.freeze({
  id: "meetonmemory",
  metadataStart: "<!-- mom:metadata:start -->",
  metadataEnd: "<!-- mom:metadata:end -->",
  markerPrefix: "mom",
  reminder8Marker: "mom:reminder-8h",
  reminder16Marker: "mom:reminder-16h",
  reminder24Marker: "mom:reminder-24h",
  reminder32Marker: "mom:reminder-32h",
  reminder40Marker: "mom:reminder-40h",
  expiredMarker: "mom:claim-expired",
  claimWelcomeMarker: "mom:claim-welcome",
  assignmentWelcomeMarker: "mom:manual-assignment-welcome",
  prChecklistMarker: "mom:pr-checklist",
  mergedMarker: "mom:pr-merged",
  firstWelcomeMarker: "mom:first-contributor-welcome",
  guidanceMarker: "mom:claim-guidance",
  overrideMarker: "mom:maintainer-override",
  ciValidationMarker: "mom:ci-validation",
});

export const COMMANDS = Object.freeze({
  claim: "/claim",
  unclaim: "/unclaim",
});

export const LIMITS = Object.freeze({
  maxActiveAssignedIssues: 4,
  guidanceCooldownHours: 12,
});

export const TIMERS = Object.freeze({
  reminder8Hours: 8,
  reminder16Hours: 16,
  reminder24Hours: 24,
  reminder32Hours: 32,
  reminder40Hours: 40,
  expirationHours: 48,
});

export const IGNORE_BOTS = Object.freeze([
  "github-actions[bot]",
  "dependabot[bot]",
  "renovate[bot]",
]);

export const MAINTAINER_ASSOCIATIONS = Object.freeze([
  "OWNER",
  "MEMBER",
  "COLLABORATOR",
]);

export const ISSUE_EVENTS = Object.freeze({
  assigned: "assigned",
  unassigned: "unassigned",
  reopened: "reopened",
  closed: "closed",
  transferred: "transferred",
});

export const PR_EVENTS = Object.freeze({
  opened: "opened",
  edited: "edited",
  synchronize: "synchronize",
  reopened: "reopened",
  readyForReview: "ready_for_review",
  closed: "closed",
});

export const EXPECTED_REPOSITORY =
  process.env.AUTOMATION_REPOSITORY || process.env.GITHUB_REPOSITORY || "";

export const REQUIRED_CHECK_NAMES = Object.freeze([
  "Code Quality",
  "Backend Validation",
  "Frontend Validation",
  "Integration Tests",
]);
