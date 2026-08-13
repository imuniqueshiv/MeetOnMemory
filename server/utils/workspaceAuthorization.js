import { isSameOrganization } from "./organizationScope.js";

export const isWorkspaceMeetingParticipant = (meeting, user) => {
  if (!meeting || !user) return false;

  const userId = user._id?.toString();
  const email = user.email;

  const isParticipant = (meeting.participants || []).some(
    (participant) =>
      participant.user?.toString() === userId ||
      (email && participant.email === email),
  );

  const isOwner = meeting.uploadedBy?.toString() === userId;

  return isParticipant || isOwner;
};

export const canAccessWorkspaceMeeting = (meeting, user) => {
  if (!isWorkspaceMeetingParticipant(meeting, user)) {
    return false;
  }

  // Personal/legacy meetings without an organization retain
  // the existing participant/owner authorization behavior.
  if (!meeting.organization) {
    return true;
  }

  return isSameOrganization(meeting.organization, user.organization);
};
