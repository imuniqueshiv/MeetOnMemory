/**
 * Whether the caller may preview/resend a meeting digest.
 * Matches `requireOwnerOrAdmin(Meeting)`: meeting uploader, or org admin/owner.
 */
export const canManageMeetingDigest = ({
  meeting,
  userData,
  dbUserId,
} = {}) => {
  if (!meeting) return false;

  const uploaderId = meeting.uploadedBy?._id || meeting.uploadedBy;
  const currentId = dbUserId || userData?._id;
  if (currentId && uploaderId && String(currentId) === String(uploaderId)) {
    return true;
  }

  const role = userData?.role;
  if (role !== "admin" && role !== "owner") return false;

  const meetingOrg = meeting.organization?._id || meeting.organization;
  const userOrg = userData?.organization?._id || userData?.organization;
  return Boolean(
    meetingOrg && userOrg && String(meetingOrg) === String(userOrg),
  );
};

export const isDigestDeliveryDisabledMessage = (message = "") =>
  /opted out|delivery is disabled/i.test(String(message));
