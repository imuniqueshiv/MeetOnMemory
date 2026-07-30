import { AUTOMATION } from "./constants.js";
import { logError, nowIso } from "./utils.js";

function defaultMetadata() {
  return {
    assignedAt: null,
    lastActivityAt: null,
    remindersSentAt: {},
    // Legacy fields retained for metadata compatibility with older issue bodies.
    reminder12SentAt: null,
    reminder18SentAt: null,
    expiredAt: null,
    welcomeSentAt: null,
    welcomeSource: null,
    guidance: {},
    processedClaimCommentIds: [],
    processedUnclaimCommentIds: [],
    // Additive flags — absent/false on legacy bodies is backward compatible.
    manualAssignment: false,
    authorPriorityExpiresAt: null,
  };
}

function extractMetadataBlock(issueBody) {
  const body = String(issueBody || "");
  const start = body.indexOf(AUTOMATION.metadataStart);
  const end = body.indexOf(AUTOMATION.metadataEnd);
  if (start < 0 || end < 0 || end <= start) return null;
  const chunk = body.slice(start + AUTOMATION.metadataStart.length, end).trim();
  return chunk || null;
}

export function readMetadata(issueBody) {
  const chunk = extractMetadataBlock(issueBody);
  if (!chunk) return defaultMetadata();
  try {
    return { ...defaultMetadata(), ...JSON.parse(chunk) };
  } catch {
    return defaultMetadata();
  }
}

export function writeMetadataToBody(issueBody, metadata) {
  const body = String(issueBody || "");
  const serialized = JSON.stringify(metadata, null, 2);
  const block = `${AUTOMATION.metadataStart}\n${serialized}\n${AUTOMATION.metadataEnd}`;
  const start = body.indexOf(AUTOMATION.metadataStart);
  const end = body.indexOf(AUTOMATION.metadataEnd);
  if (start < 0 || end < 0 || end <= start) {
    return body.trimEnd() + `\n\n${block}\n`;
  }
  const before = body.slice(0, start).trimEnd();
  const after = body.slice(end + AUTOMATION.metadataEnd.length).trimStart();
  return `${before}\n\n${block}${after ? `\n\n${after}` : "\n"}`;
}

export async function updateIssueMetadata(
  github,
  context,
  core,
  issue,
  updater,
) {
  const current = readMetadata(issue.body);
  const next = updater({ ...current });
  if (JSON.stringify(next) === JSON.stringify(current)) {
    return { issue, metadata: next };
  }
  const body = writeMetadataToBody(issue.body, next);
  try {
    const response = await github.rest.issues.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issue.number,
      body,
    });
    return { issue: response.data, metadata: next };
  } catch (error) {
    logError(core, "issues.update(metadata) failed", error, {
      issueNumber: issue.number,
    });
    return { issue, metadata: current };
  }
}

function resetReminderTracking(metadata) {
  metadata.remindersSentAt = {};
  metadata.reminder12SentAt = null;
  metadata.reminder18SentAt = null;
  return metadata;
}

export function setAssignmentMetadata(metadata, source = "claim") {
  const timestamp = nowIso();
  metadata.assignedAt = timestamp;
  metadata.lastActivityAt = timestamp;
  resetReminderTracking(metadata);
  metadata.expiredAt = null;
  metadata.welcomeSentAt = timestamp;
  metadata.welcomeSource = source;
  metadata.manualAssignment = source === "manual";
  return metadata;
}

export function clearAssignmentMetadata(metadata) {
  metadata.assignedAt = null;
  metadata.lastActivityAt = null;
  resetReminderTracking(metadata);
  metadata.expiredAt = null;
  metadata.manualAssignment = false;
  metadata.welcomeSource = null;
  metadata.welcomeSentAt = null;
  return metadata;
}

/**
 * Refresh inactivity baseline and clear reminder tracking.
 * Idempotent when `at` is not newer than the current lastActivityAt.
 */
export function touchAssigneeActivity(metadata, at = nowIso()) {
  const nextAt = at || nowIso();
  if (
    metadata.lastActivityAt &&
    new Date(nextAt) <= new Date(metadata.lastActivityAt)
  ) {
    return { metadata, changed: false };
  }
  metadata.lastActivityAt = nextAt;
  resetReminderTracking(metadata);
  return { metadata, changed: true };
}

export function isManualAssignment(metadata) {
  return (
    Boolean(metadata?.manualAssignment) || metadata?.welcomeSource === "manual"
  );
}

export { resetReminderTracking };
