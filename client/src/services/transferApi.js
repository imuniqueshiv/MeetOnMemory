import apiClient from "./apiClient";

/**
 * Service for meeting ownership transfer workflows.
 * All endpoint paths are prefixed with /api to align with backend routes.
 */
const transferApi = {
  /**
   * Initiate an ownership transfer request for a meeting.
   * @param {string} meetingId - ID of the meeting to transfer
   * @param {string} targetUserId - Target user ID to receive ownership
   * @returns {Promise} Axios response promise
   */
  initiateTransfer: (meetingId, targetUserId) =>
    apiClient.post(`/api/meetings/${meetingId}/transfers`, { targetUserId }),

  /**
   * Fetch pending transfer requests for the currently authenticated user.
   * @returns {Promise} Axios response promise containing transfer inbox
   */
  getTransferInbox: () => apiClient.get("/api/ownership-transfers/inbox"),

  /**
   * Accept an ownership transfer request.
   * @param {string} transferId - ID of the transfer request
   * @returns {Promise} Axios response promise
   */
  acceptTransfer: (transferId) =>
    apiClient.post(`/api/ownership-transfers/${transferId}/accept`),

  /**
   * Reject an ownership transfer request.
   * @param {string} transferId - ID of the transfer request
   * @returns {Promise} Axios response promise
   */
  rejectTransfer: (transferId) =>
    apiClient.post(`/api/ownership-transfers/${transferId}/reject`),
};

export default transferApi;
