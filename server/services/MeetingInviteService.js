import crypto from "crypto";
import mongoose from "mongoose";
import Meeting from "../models/meetingModel.js";
import Membership from "../models/membershipModel.js";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "../utils/errors.js";

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 10;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const generateInviteCode = () => {
  const bytes = crypto.randomBytes(INVITE_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return code;
};

const allocateUniqueInviteCode = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateInviteCode();
    const existing = await Meeting.findOne({ inviteCode: code })
      .select("_id")
      .lean();
    if (!existing) return code;
  }
  throw new ValidationError("Could not allocate a unique invite code.");
};

const invitePayload = (meeting) => ({
  code: meeting.inviteCode || null,
  enabled: meeting.inviteEnabled !== false,
  expiresAt: meeting.inviteExpiresAt || null,
  path: meeting.inviteCode ? `/meeting-invite/${meeting.inviteCode}` : null,
});

const assertMeetingManageAccess = async (meeting, user) => {
  const isOwner =
    meeting.uploadedBy?.toString() === user._id?.toString() ||
    meeting.uploadedBy?.toString() === user.id?.toString();
  if (isOwner) return;

  if (!meeting.organization) {
    throw new ForbiddenError("Only the meeting organizer can manage invites.");
  }

  const membership = await Membership.findOne({
    user: user._id,
    organization: meeting.organization,
    status: "active",
    role: { $in: ["owner", "admin"] },
  })
    .select("_id")
    .lean();

  if (!membership) {
    throw new ForbiddenError(
      "Only the organizer or an organization admin can manage invites.",
    );
  }
};

const assertCanJoinMeeting = async (meeting, user) => {
  const userId = user._id?.toString() || user.id?.toString();
  if (meeting.uploadedBy?.toString() === userId) return;

  if (meeting.organization) {
    const membership = await Membership.findOne({
      user: user._id,
      organization: meeting.organization,
      status: "active",
    })
      .select("_id")
      .lean();

    if (!membership) {
      throw new ForbiddenError(
        "You must be a member of this organization to join the meeting.",
      );
    }
    return;
  }

  // Personal meetings: invite code is the access secret for authenticated users.
};

const resolveJoinTarget = (meeting) => {
  if (meeting.archived) {
    return {
      action: "blocked",
      reason: "This meeting has been cancelled or archived.",
    };
  }

  if (meeting.status === "failed") {
    return {
      action: "blocked",
      reason: "This meeting is unavailable.",
    };
  }

  if (meeting.status === "completed") {
    return {
      action: "details",
      reason: "This meeting has already ended. Opening meeting details.",
      meetingId: meeting._id.toString(),
      path: `/meeting/${meeting._id}`,
    };
  }

  const now = Date.now();
  const meetingStart = meeting.date ? new Date(meeting.date).getTime() : null;
  const durationMs = (meeting.duration || 60) * 60 * 1000;
  const meetingEnd = meetingStart != null ? meetingStart + durationMs : null;

  const isLiveType = meeting.recordingType === "live";
  const hasStarted =
    meetingStart == null || meetingStart <= now + 15 * 60 * 1000;
  const hasEnded = meetingEnd != null && now > meetingEnd;

  if (hasEnded && meeting.status === "completed") {
    return {
      action: "details",
      reason: "This meeting has already ended.",
      meetingId: meeting._id.toString(),
      path: `/meeting/${meeting._id}`,
    };
  }

  if (isLiveType && hasStarted && !hasEnded) {
    return {
      action: "live",
      meetingId: meeting._id.toString(),
      path: `/meeting-room/${meeting._id}`,
    };
  }

  return {
    action: "details",
    meetingId: meeting._id.toString(),
    path: `/meeting/${meeting._id}`,
  };
};

export const getOrCreateInvite = async (meetingId, user) => {
  if (!isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting id.");
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new NotFoundError("Meeting not found.");

  await assertMeetingManageAccess(meeting, user);

  if (!meeting.inviteCode) {
    meeting.inviteCode = await allocateUniqueInviteCode();
    meeting.inviteEnabled = true;
    await meeting.save();
  }

  return invitePayload(meeting);
};

export const regenerateInvite = async (meetingId, user) => {
  if (!isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting id.");
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new NotFoundError("Meeting not found.");

  await assertMeetingManageAccess(meeting, user);

  meeting.inviteCode = await allocateUniqueInviteCode();
  meeting.inviteEnabled = true;
  await meeting.save();

  return invitePayload(meeting);
};

export const updateInvite = async (meetingId, user, updates = {}) => {
  if (!isValidObjectId(meetingId)) {
    throw new ValidationError("Invalid meeting id.");
  }

  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new NotFoundError("Meeting not found.");

  await assertMeetingManageAccess(meeting, user);

  if (!meeting.inviteCode) {
    meeting.inviteCode = await allocateUniqueInviteCode();
  }

  if (typeof updates.enabled === "boolean") {
    meeting.inviteEnabled = updates.enabled;
  }

  if (updates.expiresAt !== undefined) {
    if (updates.expiresAt === null || updates.expiresAt === "") {
      meeting.inviteExpiresAt = null;
    } else {
      const expires = new Date(updates.expiresAt);
      if (Number.isNaN(expires.getTime())) {
        throw new ValidationError("Invalid invite expiration date.");
      }
      meeting.inviteExpiresAt = expires;
    }
  }

  await meeting.save();
  return invitePayload(meeting);
};

export const resolveInvite = async (code, user) => {
  const inviteCode = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!inviteCode || inviteCode.length < 6) {
    throw new ValidationError("Invalid invite code.");
  }

  const meeting = await Meeting.findOne({ inviteCode }).populate(
    "organization",
    "name slug",
  );
  if (!meeting) {
    throw new NotFoundError("Invalid or unknown meeting invite link.");
  }

  if (meeting.inviteEnabled === false) {
    throw new ForbiddenError("This meeting invite link has been disabled.");
  }

  if (
    meeting.inviteExpiresAt &&
    new Date(meeting.inviteExpiresAt).getTime() < Date.now()
  ) {
    throw new ForbiddenError("This meeting invite link has expired.");
  }

  await assertCanJoinMeeting(meeting, user);

  const target = resolveJoinTarget(meeting);

  return {
    meeting: {
      id: meeting._id.toString(),
      title: meeting.title,
      date: meeting.date,
      time: meeting.time,
      status: meeting.status,
      recordingType: meeting.recordingType,
      organization: meeting.organization
        ? {
            id: meeting.organization._id?.toString(),
            name: meeting.organization.name,
            slug: meeting.organization.slug,
          }
        : null,
    },
    ...target,
  };
};
