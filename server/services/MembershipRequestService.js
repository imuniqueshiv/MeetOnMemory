import mongoose from "mongoose";
import MembershipRequest from "../models/membershipRequestModel.js";
import Membership from "../models/membershipModel.js";
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import AuditService from "./AuditService.js";
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "../utils/errors.js";

class MembershipRequestService {
  /**
   * Validate MongoDB ObjectId
   */
  static _isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  }

  /**
   * Create a new membership request
   */
  static async createRequest(userId, organizationId, message) {
    if (!organizationId) {
      throw new ValidationError("Organization ID is required.");
    }

    if (!this._isValidObjectId(organizationId)) {
      throw new ValidationError("Invalid organization ID.");
    }

    const cleanOrganizationId = new mongoose.Types.ObjectId(
      String(organizationId),
    );

    const organization = await Organization.findById(cleanOrganizationId);
    if (!organization) {
      throw new NotFoundError("Organization not found.");
    }

    // Check if user already has an active membership
    const existingMembership = await Membership.findOne({
      user: userId,
      organization: cleanOrganizationId,
      status: "active",
    }).lean();

    if (existingMembership) {
      throw new ValidationError("Already a member of this organization.");
    }

    // Check if there's already a pending request
    const existingRequest = await MembershipRequest.findOne({
      user: userId,
      organization: cleanOrganizationId,
      status: "pending",
    }).lean();

    if (existingRequest) {
      throw new AppError("Pending request already exists.", 409);
    }

    try {
      const membershipRequest = await MembershipRequest.create({
        user: userId,
        organization: cleanOrganizationId,
        message: message ? String(message).trim().substring(0, 500) : "",
        status: "pending",
      });
      return membershipRequest;
    } catch (error) {
      if (error.code === 11000) {
        throw new AppError("Duplicate request not allowed.", 409);
      }
      throw error;
    }
  }

  /**
   * Get membership requests for an organization
   */
  static async getOrganizationRequests(userId, organizationId, query) {
    const {
      status,
      search,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    if (!this._isValidObjectId(organizationId)) {
      throw new ValidationError("Invalid organization ID.");
    }
    const cleanOrganizationId = new mongoose.Types.ObjectId(
      String(organizationId),
    );

    const allowedStatuses = ["pending", "approved", "rejected", "cancelled"];
    const validStatus =
      status && allowedStatuses.includes(status) ? status : null;
    if (status && !validStatus) {
      throw new ValidationError("Invalid status value.");
    }

    const organization = await Organization.findById(cleanOrganizationId);
    if (!organization) {
      throw new NotFoundError("Organization not found.");
    }

    // Check if user is admin or owner
    const membership = await Membership.findOne({
      user: userId,
      organization: cleanOrganizationId,
      role: "admin",
      status: "active",
    }).lean();

    const isOwner = organization.owner.toString() === userId.toString();
    if (!membership && !isOwner) {
      throw new ForbiddenError("Not authorized to view requests.");
    }

    const filter = { organization: { $eq: cleanOrganizationId } };
    if (validStatus) {
      filter.status = { $eq: validStatus };
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const validSortFields = ["createdAt", "status", "name"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sortObj = {};
    if (sortField === "name") {
      sortObj["user.name"] = sortDirection;
    } else {
      sortObj[sortField] = sortDirection;
    }

    const requests = await MembershipRequest.find(filter)
      .populate("user", "name email profilePic isAccountVerified")
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    let filteredRequests = requests;
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      filteredRequests = requests.filter((req) => {
        const userName = req.user?.name?.toLowerCase() || "";
        const userEmail = req.user?.email?.toLowerCase() || "";
        const uId = req.user?._id?.toString() || "";
        return (
          userName.includes(searchTerm) ||
          userEmail.includes(searchTerm) ||
          uId.includes(searchTerm)
        );
      });
    }

    const total = await MembershipRequest.countDocuments(filter);
    const filteredTotal = search ? filteredRequests.length : total;

    return {
      requests: filteredRequests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredTotal,
        pages: Math.ceil(filteredTotal / limitNum),
      },
    };
  }

  /**
   * Get user's membership requests
   */
  static async getUserRequests(userId) {
    const requests = await MembershipRequest.find({ user: userId })
      .populate("organization", "name slug description logo")
      .sort({ createdAt: -1 })
      .lean();
    return requests;
  }

  /**
   * Approve a membership request
   */
  static async approveRequest(userId, requestId, reviewNotes) {
    if (!this._isValidObjectId(requestId)) {
      throw new ValidationError("Invalid membership request ID.");
    }
    const cleanRequestId = new mongoose.Types.ObjectId(String(requestId));

    const request =
      await MembershipRequest.findById(cleanRequestId).populate("organization");
    if (!request) {
      throw new NotFoundError("Membership request not found.");
    }
    if (request.status !== "pending") {
      throw new ValidationError("Request is not in pending status.");
    }

    const membership = await Membership.findOne({
      user: userId,
      organization: request.organization._id,
      role: "admin",
      status: "active",
    }).lean();
    const isOwner = request.organization.owner.toString() === userId.toString();
    if (!membership && !isOwner) {
      throw new ForbiddenError("Not authorized to approve requests.");
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    let newMembership;

    try {
      request.status = "approved";
      request.reviewedBy = userId;
      request.reviewedAt = new Date();
      request.reviewNotes = reviewNotes
        ? String(reviewNotes).trim().substring(0, 500)
        : "";
      await request.save({ session });

      [newMembership] = await Membership.create(
        [
          {
            user: request.user,
            organization: request.organization._id,
            role: "member",
            status: "active",
          },
        ],
        { session },
      );

      await userModel.findByIdAndUpdate(
        request.user,
        {
          role: "member",
          organization: request.organization._id,
          hasCompletedOnboarding: true,
        },
        { session },
      );

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    AuditService.logAction({
      actorId: userId,
      action: "MEMBERSHIP_REQUEST_APPROVED",
      entity: "MembershipRequest",
      entityId: request._id,
      organizationId: request.organization._id,
      details: { userId: request.user },
    });

    return { request, membership: newMembership };
  }

  /**
   * Reject a membership request
   */
  static async rejectRequest(userId, requestId, reviewNotes) {
    if (!this._isValidObjectId(requestId)) {
      throw new ValidationError("Invalid membership request ID.");
    }
    const cleanRequestId = new mongoose.Types.ObjectId(String(requestId));

    const request =
      await MembershipRequest.findById(cleanRequestId).populate("organization");
    if (!request) {
      throw new NotFoundError("Membership request not found.");
    }
    if (request.status !== "pending") {
      throw new ValidationError("Request is not in pending status.");
    }

    const membership = await Membership.findOne({
      user: userId,
      organization: request.organization._id,
      role: "admin",
      status: "active",
    }).lean();
    const isOwner = request.organization.owner.toString() === userId.toString();
    if (!membership && !isOwner) {
      throw new ForbiddenError("Not authorized to reject requests.");
    }

    request.status = "rejected";
    request.reviewedBy = userId;
    request.reviewedAt = new Date();
    request.reviewNotes = reviewNotes
      ? String(reviewNotes).trim().substring(0, 500)
      : "";
    await request.save();

    AuditService.logAction({
      actorId: userId,
      action: "MEMBERSHIP_REQUEST_REJECTED",
      entity: "MembershipRequest",
      entityId: request._id,
      organizationId: request.organization._id,
      details: { userId: request.user, reviewNotes },
    });

    return { request };
  }

  /**
   * Cancel a membership request
   */
  static async cancelRequest(userId, requestId) {
    if (!this._isValidObjectId(requestId)) {
      throw new ValidationError("Invalid membership request ID.");
    }
    const cleanRequestId = new mongoose.Types.ObjectId(String(requestId));

    const request = await MembershipRequest.findById(cleanRequestId);
    if (!request) {
      throw new NotFoundError("Membership request not found.");
    }

    if (request.user.toString() !== userId.toString()) {
      throw new ForbiddenError("Not authorized to cancel this request.");
    }

    if (request.status !== "pending") {
      throw new ValidationError("Can only cancel pending requests.");
    }

    request.status = "cancelled";
    await request.save();

    return { request };
  }

  /**
   * Bulk approve membership requests
   */
  static async bulkApproveRequests(userId, requestIds, reviewNotes) {
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      throw new ValidationError("Request IDs array is required.");
    }

    const validRequestIds = requestIds
      .filter((id) => this._isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(String(id)));

    if (validRequestIds.length === 0) {
      throw new ValidationError("No valid request IDs provided.");
    }

    const requests = await MembershipRequest.find({
      _id: { $in: validRequestIds },
    }).populate("organization");

    if (requests.length === 0) {
      throw new NotFoundError("No membership requests found.");
    }

    const results = [];
    const errors = [];

    // Run each in its own transaction (or without if we can't batch easily, but we'll use transaction inside the loop or just process one by one)
    for (const request of requests) {
      if (request.status !== "pending") {
        errors.push({
          requestId: request._id,
          message: "Request is not in pending status.",
        });
        continue;
      }

      const membership = await Membership.findOne({
        user: userId,
        organization: request.organization._id,
        role: "admin",
        status: "active",
      }).lean();
      const isOwner =
        request.organization.owner.toString() === userId.toString();

      if (!membership && !isOwner) {
        errors.push({
          requestId: request._id,
          message: "Not authorized to approve this request.",
        });
        continue;
      }

      const session = await mongoose.startSession();
      session.startTransaction();
      let newMembership;
      try {
        request.status = "approved";
        request.reviewedBy = userId;
        request.reviewedAt = new Date();
        request.reviewNotes = reviewNotes
          ? String(reviewNotes).trim().substring(0, 500)
          : "";
        await request.save({ session });

        [newMembership] = await Membership.create(
          [
            {
              user: request.user,
              organization: request.organization._id,
              role: "member",
              status: "active",
            },
          ],
          { session },
        );

        await userModel.findByIdAndUpdate(
          request.user,
          {
            role: "member",
            organization: request.organization._id,
            hasCompletedOnboarding: true,
          },
          { session },
        );

        await session.commitTransaction();

        AuditService.logAction({
          actorId: userId,
          action: "MEMBERSHIP_REQUEST_APPROVED",
          entity: "MembershipRequest",
          entityId: request._id,
          organizationId: request.organization._id,
          details: { userId: request.user },
        });

        results.push({
          requestId: request._id,
          membershipId: newMembership._id,
          status: "approved",
        });
      } catch (_error) {
        await session.abortTransaction();
        errors.push({
          requestId: request._id,
          message: "Internal server error during approval.",
        });
      } finally {
        session.endSession();
      }
    }

    return { results, errors };
  }

  /**
   * Bulk reject membership requests
   */
  static async bulkRejectRequests(userId, requestIds, reviewNotes) {
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      throw new ValidationError("Request IDs array is required.");
    }

    const validRequestIds = requestIds
      .filter((id) => this._isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(String(id)));

    if (validRequestIds.length === 0) {
      throw new ValidationError("No valid request IDs provided.");
    }

    const requests = await MembershipRequest.find({
      _id: { $in: validRequestIds },
    }).populate("organization");

    if (requests.length === 0) {
      throw new NotFoundError("No membership requests found.");
    }

    const results = [];
    const errors = [];

    for (const request of requests) {
      if (request.status !== "pending") {
        errors.push({
          requestId: request._id,
          message: "Request is not in pending status.",
        });
        continue;
      }

      const membership = await Membership.findOne({
        user: userId,
        organization: request.organization._id,
        role: "admin",
        status: "active",
      }).lean();
      const isOwner =
        request.organization.owner.toString() === userId.toString();

      if (!membership && !isOwner) {
        errors.push({
          requestId: request._id,
          message: "Not authorized to reject this request.",
        });
        continue;
      }

      request.status = "rejected";
      request.reviewedBy = userId;
      request.reviewedAt = new Date();
      request.reviewNotes = reviewNotes
        ? String(reviewNotes).trim().substring(0, 500)
        : "";
      await request.save();

      AuditService.logAction({
        actorId: userId,
        action: "MEMBERSHIP_REQUEST_REJECTED",
        entity: "MembershipRequest",
        entityId: request._id,
        organizationId: request.organization._id,
        details: { userId: request.user, reviewNotes },
      });

      results.push({ requestId: request._id, status: "rejected" });
    }

    return { results, errors };
  }
}

export default MembershipRequestService;
