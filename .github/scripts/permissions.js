import { MAINTAINER_ASSOCIATIONS, TIMERS } from "./constants.js";
import { getCollaboratorPermission } from "./helpers.js";

export function issueAuthorRole(issue) {
  const association = String(issue?.author_association || "").toUpperCase();
  if (association === "OWNER") return "owner";
  if (association === "MEMBER") return "maintainer";
  if (association === "COLLABORATOR") return "collaborator";
  return "external";
}

export function actorRoleFromPermission(permissionLevel) {
  if (permissionLevel === "admin") return "owner";
  if (permissionLevel === "maintain" || permissionLevel === "write")
    return "maintainer";
  if (permissionLevel === "triage") return "collaborator";
  if (permissionLevel === "read") return "contributor";
  return "external";
}

export function isMaintainerAssociation(association) {
  return MAINTAINER_ASSOCIATIONS.includes(
    String(association || "").toUpperCase(),
  );
}

export async function resolveActorRole(github, context, core, actor) {
  if (actor === context.repo.owner) return "owner";
  const permission = await getCollaboratorPermission(
    github,
    context,
    core,
    actor,
  );
  return actorRoleFromPermission(permission);
}

/**
 * Effective author-priority expiry for contributor-created issues.
 * Legacy bodies without authorPriorityExpiresAt use created_at + 48h.
 */
export function getAuthorPriorityExpiresAt(issue, metadata = {}) {
  if (metadata?.authorPriorityExpiresAt) {
    return metadata.authorPriorityExpiresAt;
  }
  if (!issue?.created_at) return null;
  const created = new Date(issue.created_at);
  if (Number.isNaN(created.getTime())) return null;
  return new Date(
    created.getTime() + TIMERS.authorPriorityHours * 60 * 60 * 1000,
  ).toISOString();
}

export function isAuthorPriorityActive(issue, metadata = {}, now = new Date()) {
  const authorRole = issueAuthorRole(issue);
  if (["owner", "maintainer", "collaborator"].includes(authorRole)) {
    return false;
  }
  const expiresAt = getAuthorPriorityExpiresAt(issue, metadata);
  // No usable timestamp: preserve legacy author-only soft lock.
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > now.getTime();
}

export function canAutoClaimIssue(issue, actor, metadata = {}) {
  const authorRole = issueAuthorRole(issue);
  const issueAuthor = issue?.user?.login;
  if (["owner", "maintainer", "collaborator"].includes(authorRole)) return true;
  if (issueAuthor === actor) return true;
  return !isAuthorPriorityActive(issue, metadata);
}

export function isMaintainerRole(role) {
  return role === "owner" || role === "maintainer" || role === "collaborator";
}

export function canUnclaim(actor, actorRole, currentAssignee, metadata = {}) {
  const manual =
    Boolean(metadata?.manualAssignment) || metadata?.welcomeSource === "manual";
  if (manual) {
    return isMaintainerRole(actorRole);
  }
  if (actor === currentAssignee) return true;
  return isMaintainerRole(actorRole);
}
