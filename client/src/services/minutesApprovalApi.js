import apiClient from "./apiClient";

/**
 * Fetch minutes approval status for a given meeting.
 * @param {string} meetingId
 */
export const getApprovalStatus = (meetingId) => {
  return apiClient.get(`/api/meetings/${meetingId}/minutes-approval`);
};

/**
 * Submit minutes for approval.
 * @param {string} meetingId
 * @param {string} snapshotSummary - Summary text of the minutes snapshot
 * @param {Array<string>} approvers - Array of approver user IDs
 */
export const submitApproval = (meetingId, snapshotSummary, approvers) => {
  return apiClient.post(`/api/meetings/${meetingId}/minutes-approval/submit`, {
    snapshotSummary,
    approvers,
  });
};

/**
 * Respond to a minutes approval request.
 * @param {string} meetingId
 * @param {string} status - 'approved' or 'rejected'
 * @param {string} [comment] - Optional feedback comment
 */
export const respondApproval = (meetingId, status, comment = "") => {
  return apiClient.put(`/api/meetings/${meetingId}/minutes-approval/respond`, {
    status,
    comment,
  });
};
