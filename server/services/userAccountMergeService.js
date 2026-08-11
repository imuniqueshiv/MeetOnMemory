// server/services/userAccountMergeService.js
/**
 * Clerk placeholder-account merge (Issue #1114).
 *
 * A placeholder account is created when a Clerk session JWT arrives without a
 * verified email, so the service stores `user_xxx@clerk.placeholder` (see
 * authLinkingService). When the real email later shows up in the JWT it can
 * already be owned by a *different* verified account. Previously that raced
 * straight into the unique email index and surfaced as a duplicate-key 500.
 *
 * This module detects the collision, merges the placeholder into the verified
 * owner — transferring the Clerk identity and every document the placeholder
 * owned, then deleting the placeholder row — so user data is preserved and no
 * duplicate records are left behind.
 */

import userModel from "../models/userModel.js";
import Activity from "../models/activityModel.js";
import AiSummaryTemplate from "../models/aiSummaryTemplateModel.js";
import Attachment from "../models/attachmentModel.js";
import AuditLog from "../models/auditLogModel.js";
import AuditLogExport from "../models/auditLogExportModel.js";
import AutomationRule from "../models/automationRuleModel.js";
import Bookmark from "../models/bookmarkModel.js";
import CalendarConnection from "../models/calendarConnectionModel.js";
import CalendarIntegration from "../models/calendarIntegrationModel.js";
import ChatSession from "../models/ChatSession.js";
import Comment from "../models/commentModel.js";
import ConflictSet from "../models/conflictModel.js";
import DigestPreference from "../models/digestPreferenceModel.js";
import FollowUpThread from "../models/followUpThreadModel.js";
import GraphSnapshot from "../models/graphSnapshotModel.js";
import Invitation from "../models/invitationModel.js";
import Meeting from "../models/meetingModel.js";
import MeetingClip from "../models/meetingClipModel.js";
import MeetingFeedback from "../models/meetingFeedbackModel.js";
import MeetingSeries from "../models/meetingSeriesModel.js";
import MeetingTemplate from "../models/meetingTemplateModel.js";
import Membership from "../models/membershipModel.js";
import MembershipRequest from "../models/membershipRequestModel.js";
import Notification from "../models/notificationModel.js";
import NotificationPreference from "../models/notificationPreferenceModel.js";
import NoteVersion from "../models/noteVersionModel.js";
import Organization from "../models/organizationModel.js";
import PersonalNote from "../models/personalNoteModel.js";
import Policy from "../models/policyModel.js";
import PolicyCompliance from "../models/policyComplianceModel.js";
import Poll from "../models/pollModel.js";
import Reaction from "../models/reactionModel.js";
import RecapDelivery from "../models/recapDeliveryModel.js";
import RecapPreference from "../models/recapPreferenceModel.js";
import RecapSchedule from "../models/recapScheduleModel.js";
import ReportTemplate from "../models/reportTemplateModel.js";
import SharedLink from "../models/sharedLinkModel.js";
import SpeakerMapping from "../models/speakerMappingModel.js";
import Tag from "../models/tagModel.js";
import TemplateLibrary from "../models/templateLibraryModel.js";
import ThreadReply from "../models/threadReplyModel.js";
import TranscriptAnnotation from "../models/transcriptAnnotationModel.js";

export const isPlaceholderClerkEmail = (email) => {
  if (!email || typeof email !== "string") return true;
  return (
    email.endsWith("@clerk.placeholder") ||
    /^user_[A-Za-z0-9]+(@|$)/.test(email)
  );
};

/**
 * Raised when two accounts collide but no safe merge is possible. Carried all
 * the way up to the HTTP layer so callers get a meaningful error instead of a
 * raw duplicate-key failure.
 */
export class AccountMergeError extends Error {
  constructor(message) {
    super(message);
    this.name = "AccountMergeError";
  }
}

/**
 * Merge a Clerk placeholder account into the existing verified owner of the
 * real email.
 *
 * @param {Object} params
 * @param {Object} params.placeholder - Full placeholder user document (has the
 *   placeholder email).
 * @param {Object} params.verified - Lightweight email-owner document
 *   (`{ _id, clerkUserId, email }`).
 * @param {string} params.clerkUserId - Clerk identity being claimed.
 * @param {string} params.email - Real email that triggered the collision.
 * @param {string} [params.name]
 * @param {string} [params.profilePic]
 * @returns {Promise<Object>} The verified user document (password excluded).
 */
export const mergePlaceholderAccount = async ({
  placeholder,
  verified,
  clerkUserId,
  email,
  name,
  profilePic,
}) => {
  const placeholderId = placeholder._id;
  const verifiedId = verified._id;

  if (placeholderId.toString() === verifiedId.toString()) {
    return placeholder;
  }

  // ── Eligibility guards ──────────────────────────────────────────────────
  // Only merge when there is no ambiguity about which account is canonical.
  if (isPlaceholderClerkEmail(verified.email)) {
    throw new AccountMergeError(
      `Cannot link Clerk account: email "${email}" belongs to another placeholder account. Automatic merging is not possible.`,
    );
  }

  if (verified.clerkUserId && verified.clerkUserId !== clerkUserId) {
    throw new AccountMergeError(
      `Cannot link Clerk account: email "${email}" already belongs to a different Clerk-linked account. Automatic merging is not possible.`,
    );
  }

  const verifiedUser = await userModel.findById(verifiedId).select("-password");
  if (!verifiedUser) {
    throw new AccountMergeError(
      "Cannot link Clerk account: the verified account for this email no longer exists.",
    );
  }

  // ── Merge ───────────────────────────────────────────────────────────────
  // 1) Move every document the placeholder owned onto the verified account.
  await reassignOwnedData(placeholderId, verifiedId);

  // 2) Claim the Clerk identity (already a no-op when linked).
  if (!verifiedUser.clerkUserId) {
    verifiedUser.clerkUserId = clerkUserId;
  }

  // 3) Fill display/profile details only where the verified account is bare.
  if (profilePic && !verifiedUser.profilePic) {
    verifiedUser.profilePic = profilePic;
  }
  if (name && (!verifiedUser.name || verifiedUser.name === "User")) {
    verifiedUser.name = name;
  }

  // 4) Preserve onboarding progress if the placeholder was further along.
  if (!verifiedUser.organization && placeholder.organization) {
    verifiedUser.organization = placeholder.organization;
  }
  if (
    placeholder.hasCompletedOnboarding &&
    (!verifiedUser.role || !verifiedUser.hasCompletedOnboarding)
  ) {
    verifiedUser.role = verifiedUser.role || placeholder.role || null;
    verifiedUser.hasCompletedOnboarding = true;
  }

  // 5) Remove the placeholder row. This must happen *before* saving the
  //    verified account: the placeholder still owns the `clerkUserId` (and
  //    placeholder email) that we are about to claim, so saving first would
  //    trip the unique indexes. Its data was already reassigned in step 1, and
  //    if a later failure interrupts the save, the next sync converges via the
  //    legacy email-link path.
  await userModel.deleteOne({ _id: placeholderId });

  await verifiedUser.save();

  return verifiedUser;
};

const toIdString = (id) => (id && id.toString ? id.toString() : String(id));

/**
 * Reassign documents owned by `fromId` to `toId` across every collection that
 * references a user. Uniquely indexed collections (one row per user, or one
 * per user + key) are de-duplicated first so the transfer never trips the
 * very duplicate-key error the merge exists to prevent.
 */
const reassignOwnedData = async (fromId, toId) => {
  const from = toIdString(fromId);
  const to = toIdString(toId);

  // 1) Unique-keyed collections: drop the placeholder's row when the verified
  //    user already owns the same key, then reassign the survivors.
  const dedupeAndReassign = async (Model, userField, uniqueKeyFields) => {
    const docs = await Model.find({ [userField]: from }).lean();
    const conflicts = [];
    for (const doc of docs) {
      const filter = { [userField]: to };
      for (const key of uniqueKeyFields) {
        filter[key] = doc[key];
      }
      const existing = await Model.findOne(filter).select("_id").lean();
      if (existing) conflicts.push(doc._id);
    }
    if (conflicts.length) {
      await Model.deleteMany({ _id: { $in: conflicts } });
    }
    await Model.updateMany(
      { [userField]: from },
      { $set: { [userField]: to } },
    );
  };

  await dedupeAndReassign(Bookmark, "user", ["meeting"]);
  await dedupeAndReassign(CalendarConnection, "user", ["provider"]);
  await dedupeAndReassign(CalendarIntegration, "userId", ["provider"]);
  await dedupeAndReassign(DigestPreference, "user", []);
  await dedupeAndReassign(MeetingFeedback, "userId", ["meetingId"]);
  await dedupeAndReassign(Membership, "user", ["organization"]);
  await dedupeAndReassign(NotificationPreference, "user", []);
  await dedupeAndReassign(PersonalNote, "userId", ["meetingId"]);
  await dedupeAndReassign(RecapDelivery, "userId", ["meetingId"]);
  await dedupeAndReassign(RecapPreference, "userId", []);
  await dedupeAndReassign(RecapSchedule, "userId", ["organizationId"]);

  // 2) Plain top-level user references.
  const direct = [
    [Activity, "actor"],
    [AiSummaryTemplate, "createdBy"],
    [Attachment, "uploadedBy"],
    [AuditLog, "actor"],
    [AuditLogExport, "requestedBy"],
    [AutomationRule, "createdBy"],
    [ChatSession, "userId"],
    [Comment, "author"],
    [FollowUpThread, "createdBy"],
    [FollowUpThread, "resolvedBy"],
    [GraphSnapshot, "triggeredBy"],
    [Invitation, "invitedBy"],
    [Invitation, "acceptedBy"],
    [Meeting, "uploadedBy"],
    [MeetingClip, "createdBy"],
    [MeetingSeries, "createdBy"],
    [MeetingTemplate, "createdBy"],
    [MembershipRequest, "user"],
    [MembershipRequest, "reviewedBy"],
    [Notification, "user"],
    [NoteVersion, "changedBy"],
    [Policy, "uploadedBy"],
    [Policy, "lastEditedBy"],
    [PolicyCompliance, "reviewedBy"],
    [Poll, "createdBy"],
    [Reaction, "user"],
    [ReportTemplate, "createdBy"],
    [SharedLink, "createdBy"],
    [SpeakerMapping, "createdBy"],
    [Tag, "createdBy"],
    [TemplateLibrary, "publishedBy"],
    [ThreadReply, "author"],
    [TranscriptAnnotation, "author"],
    [TranscriptAnnotation, "resolvedBy"],
  ];

  for (const [Model, field] of direct) {
    await Model.updateMany({ [field]: from }, { $set: { [field]: to } });
  }

  // 3) Nested subdocument arrays.
  await Comment.updateMany(
    { "reactions.user": from },
    { $set: { "reactions.$[r].user": to } },
    { arrayFilters: [{ "r.user": from }] },
  );

  await MeetingClip.updateMany(
    { "annotations.user": from },
    { $set: { "annotations.$[a].user": to } },
    { arrayFilters: [{ "a.user": from }] },
  );

  await Policy.updateMany(
    { "previousVersions.uploadedBy": from },
    { $set: { "previousVersions.$[v].uploadedBy": to } },
    { arrayFilters: [{ "v.uploadedBy": from }] },
  );

  await TemplateLibrary.updateMany(
    { "ratings.userId": from },
    { $set: { "ratings.$[r].userId": to } },
    { arrayFilters: [{ "r.userId": from }] },
  );

  await ConflictSet.updateMany(
    { "resolution.resolvedBy": from },
    { $set: { "resolution.resolvedBy": to } },
  );

  // 4) Arrays of user ObjectIds (thread mentions, poll votes).
  await reassignScalarUserIdArray(ThreadReply, "mentions", from, to);
  await reassignPollVotes(from, to);

  // 5) Organization ownership + membership entries.
  await reassignOrganizationReferences(from, to);
};

/**
 * Move a user id out of a plain array-of-ObjectId field (e.g. thread mentions).
 * Where the target user is already referenced the placeholder entries are
 * dropped, otherwise they are rewritten in place.
 */
const reassignScalarUserIdArray = async (Model, path, from, to) => {
  const docs = await Model.find({ [path]: from });
  for (const doc of docs) {
    const values = doc[path] || [];
    let changed = false;
    const alreadyHasTarget = values.some(
      (v) => toIdString(v) === to && toIdString(v) !== from,
    );
    const next = values.filter((v) => toIdString(v) !== from);
    if (alreadyHasTarget) {
      changed = next.length !== values.length;
      doc[path] = next;
    } else if (next.length !== values.length) {
      next.push(to);
      changed = true;
      doc[path] = next;
    }
    if (changed) await doc.save();
  }
};

/**
 * Poll votes live in `options[].votes[]`. Rewrites the placeholder's votes to
 * the verified user, dropping them when the verified user already voted on the
 * same option so a poll can never end up with duplicate votes.
 */
const reassignPollVotes = async (from, to) => {
  const polls = await Poll.find({ "options.votes": from });
  for (const poll of polls) {
    let changed = false;
    for (const option of poll.options) {
      const votes = option.votes || [];
      const alreadyHasTarget = votes.some(
        (v) => toIdString(v) === to && toIdString(v) !== from,
      );
      const next = votes.filter((v) => toIdString(v) !== from);
      if (alreadyHasTarget) {
        changed = changed || next.length !== votes.length;
        option.votes = next;
      } else if (next.length !== votes.length) {
        next.push(to);
        option.votes = next;
        changed = true;
      }
    }
    if (changed) await poll.save();
  }
};

/**
 * Organizations: transfer ownership where the placeholder owned the org, and
 * fold the placeholder's membership entries into the verified user's (dropping
 * them when the verified user is already a member of that org).
 */
const reassignOrganizationReferences = async (from, to) => {
  await Organization.updateMany({ owner: from }, { $set: { owner: to } });

  const orgs = await Organization.find({ "members.userId": from });
  for (const org of orgs) {
    const members = org.members || [];
    const placeholderEntries = members.filter(
      (m) => m.userId && toIdString(m.userId) === from,
    );
    const next = members.filter(
      (m) => !m.userId || toIdString(m.userId) !== from,
    );
    for (const m of next) {
      if (m.invitedBy && toIdString(m.invitedBy) === from) {
        m.invitedBy = to;
      }
    }
    if (
      placeholderEntries.length &&
      !next.some((m) => m.userId && toIdString(m.userId) === to)
    ) {
      const [entry] = placeholderEntries;
      next.push({ ...entry, userId: to });
    }
    if (next.length !== members.length) {
      org.members = next;
      await org.save();
    }
  }
};
