import MembershipRequestService from "../services/MembershipRequestService.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

/**
 * ✅ Create Membership Request
 * POST /api/membership-requests
 */
export const createMembershipRequest = async (req, res, next) => {
  try {
    const { organizationId, message } = req.body;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const membershipRequest = await MembershipRequestService.createRequest(
      req.user.id,
      organizationId,
      message,
    );

    sendSuccess(
      res,
      { membershipRequest },
      "Membership request created successfully.",
      201,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * ✅ Get Membership Requests for Organization (with search, filter, pagination, sorting)
 * GET /api/membership-requests/organization/:organizationId
 */
export const getOrganizationMembershipRequests = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const data = await MembershipRequestService.getOrganizationRequests(
      req.user.id,
      organizationId,
      req.query,
    );

    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

/**
 * ✅ Get User's Membership Requests
 * GET /api/membership-requests/user
 */
export const getUserMembershipRequests = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const requests = await MembershipRequestService.getUserRequests(
      req.user.id,
    );

    sendSuccess(res, { requests });
  } catch (error) {
    next(error);
  }
};

/**
 * ✅ Approve Membership Request
 * PATCH /api/membership-requests/:id/approve
 */
export const approveMembershipRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewNotes } = req.body;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const { request, membership } =
      await MembershipRequestService.approveRequest(
        req.user.id,
        id,
        reviewNotes,
      );

    sendSuccess(
      res,
      { request, membership },
      "Membership request approved successfully.",
    );
  } catch (error) {
    next(error);
  }
};

/**
 * ✅ Reject Membership Request
 * PATCH /api/membership-requests/:id/reject
 */
export const rejectMembershipRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewNotes } = req.body;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const { request } = await MembershipRequestService.rejectRequest(
      req.user.id,
      id,
      reviewNotes,
    );

    sendSuccess(res, { request }, "Membership request rejected successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * ✅ Cancel Membership Request
 * PATCH /api/membership-requests/:id/cancel
 */
export const cancelMembershipRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const { request } = await MembershipRequestService.cancelRequest(
      req.user.id,
      id,
    );

    sendSuccess(res, { request }, "Membership request cancelled successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * ✅ Bulk Approve Membership Requests
 * POST /api/membership-requests/bulk-approve
 */
export const bulkApproveMembershipRequests = async (req, res, next) => {
  try {
    const { requestIds, reviewNotes } = req.body;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const { results, errors } =
      await MembershipRequestService.bulkApproveRequests(
        req.user.id,
        requestIds,
        reviewNotes,
      );

    sendSuccess(
      res,
      { results, errors },
      `Processed ${results.length} requests successfully.`,
    );
  } catch (error) {
    next(error);
  }
};

/**
 * ✅ Bulk Reject Membership Requests
 * POST /api/membership-requests/bulk-reject
 */
export const bulkRejectMembershipRequests = async (req, res, next) => {
  try {
    const { requestIds, reviewNotes } = req.body;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const { results, errors } =
      await MembershipRequestService.bulkRejectRequests(
        req.user.id,
        requestIds,
        reviewNotes,
      );

    sendSuccess(
      res,
      { results, errors },
      `Processed ${results.length} requests successfully.`,
    );
  } catch (error) {
    next(error);
  }
};
