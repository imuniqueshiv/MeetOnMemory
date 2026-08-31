// server/controllers/organizationController.js
//
// HTTP layer only — parse request, call service, send response.
// All business logic lives in server/services/OrganizationService.js.

import * as OrganizationService from "../services/OrganizationService.js";
import { sendSuccess } from "../utils/responseHandler.js";
import {
  UnauthorizedError,
  ValidationError,
  ConflictError,
} from "../utils/errors.js";

/**
 * ✅ Create or Join Organization
 * - If org exists → join as Member
 * - If not → create new org as Admin
 * - Returns updated user with populated org
 */
export const createOrJoinOrganization = async (req, res, next) => {
  try {
    const { name } = req.body;

    // Validate authentication
    if (!req.user || !req.user.id) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    // Validate org name
    if (!name || !name.trim()) {
      return next(new ValidationError("Please provide an organization name."));
    }

    const result = await OrganizationService.createOrJoinOrganization(
      req.user.id,
      name.trim(),
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Get All Organizations (For listing)
 * Returns: { success: true, organizations: [...] }
 */
export const getAllOrganizations = async (req, res, next) => {
  try {
    const result = await OrganizationService.getAllOrganizations();
    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Join organization by ID (member flow)
 * Body: { organizationId: "<org id>" }
 */
export const joinOrganization = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const result = await OrganizationService.joinOrganizationById(
      req.user.id,
      req.body.organizationId,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Select organization (for users with multiple orgs)
 * Body: { organizationId: "<org id>" }
 */
export const selectOrganization = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const result = await OrganizationService.selectOrganization(
      req.user.id,
      req.body.organizationId,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Get organization members
 * Returns: { success: true, members: [...] }
 */
export const getOrganizationMembers = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const result = await OrganizationService.getOrganizationMembers(
      req.user.id,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Get public organization profile by slug
 * Returns only public information, no private data
 * Route: GET /api/organizations/public/:slug
 */
export const getPublicOrganizationBySlug = async (req, res, next) => {
  try {
    const result = await OrganizationService.getPublicOrganizationBySlug(
      req.params.slug,
    );

    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Browse public organizations with pagination and filters
 */
export const browsePublicOrganizations = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const search = req.query.search || "";
    const sortBy = req.query.sortBy || "createdAt";
    const filter = req.query.filter || "all";

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 50) {
      return next(
        new ValidationError(
          "Invalid pagination parameters. Page must be >= 1 and limit must be between 1 and 50.",
        ),
      );
    }

    const userId = req.user?.id || req.user?._id || null;

    const result = await OrganizationService.browsePublicOrganizations({
      userId,
      page,
      limit,
      search,
      sortBy,
      filter,
    });

    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Search organizations (public only)
 * Query params: q (search query), page, limit
 * Returns: { success: true, organizations: [...], pagination: {...} }
 */
export const searchOrganizations = async (req, res, next) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const userId = req.user?.id || req.user?._id || null;

    if (!q || !q.trim()) {
      return next(new ValidationError("Search query is required."));
    }

    if (q.trim().length < 2) {
      return next(
        new ValidationError("Search query must be at least 2 characters."),
      );
    }

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 50) {
      return next(new ValidationError("Invalid pagination parameters."));
    }

    const result = await OrganizationService.searchOrganizations(
      q,
      page,
      limit,
      userId,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Get user's joined organizations
 * GET /api/organizations/user
 */
export const getUserOrganizations = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const result = await OrganizationService.getUserOrganizations(req.user.id);

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Create Organization (New version)
 * POST /api/organizations
 */
export const createOrganization = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const result = await OrganizationService.createOrganization(
      req.user.id,
      req.body,
    );

    sendSuccess(res, result, null, 201);
  } catch (error) {
    if (error.code === 11000) {
      return next(new ConflictError("Organization slug already exists."));
    }
    return next(error);
  }
};

/**
 * ✅ Get All Organizations (Paginated)
 * GET /api/organizations
 */
export const getOrganizations = async (req, res, next) => {
  try {
    const { visibility, page = 1, limit = 20 } = req.query;

    if (!req.user || !req.user.id) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const result = await OrganizationService.getOrganizations(
      req.user.id,
      visibility,
      page,
      limit,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Get Organization by ID or Slug
 * GET /api/organizations/:idOrSlug
 */
export const getOrganizationById = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const result = await OrganizationService.getOrganizationById(
      req.params.idOrSlug,
      req.user.id,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Get Organization Settings
 * GET /api/organizations/current/settings
 */
export const getOrganizationSettings = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const orgIdOrSlug = req.query.orgId || req.params.id || null;
    const result = await OrganizationService.getOrganizationSettings(
      req.user.id,
      orgIdOrSlug,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Update Organization
 * PUT /api/organizations/:id
 */
export const updateOrganization = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const result = await OrganizationService.updateOrganization(
      req.user.id,
      req.params.id,
      req.body,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Delete Organization
 * DELETE /api/organizations/:id
 */
export const deleteOrganization = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const result = await OrganizationService.deleteOrganization(
      req.user.id,
      req.params.id,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Get Organization Members by ID
 * GET /api/organizations/:id/members
 */
export const getOrganizationMembersById = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const result = await OrganizationService.getOrganizationMembersById(
      req.user.id,
      req.params.id,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Get Organization Leaderboard
 * GET /api/organizations/:id/leaderboard
 */
export const getOrganizationLeaderboard = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const orgId =
      req.params.id ||
      (req.user.organization ? req.user.organization.toString() : null);
    if (!orgId) {
      return next(new ValidationError("Organization ID is required."));
    }

    const result = await OrganizationService.getOrganizationLeaderboard(
      req.user.id,
      orgId,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Invite Member to Organization
 * POST /api/organizations/:id/invite
 */
export const inviteMember = async (req, res, next) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const userId = req.user.id || req.user._id;
    const orgId = req.params.id;
    const { email, role, message } = req.body;

    if (!email) {
      return next(new ValidationError("Email address is required."));
    }

    const result = await OrganizationService.inviteMemberToOrganization(
      userId,
      orgId,
      { email, role, message },
    );

    sendSuccess(res, result, null, 201);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Accept Invite Token
 * POST /api/organizations/invite/:token/accept
 */
export const acceptInviteToken = async (req, res, next) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const userId = req.user.id || req.user._id;
    const { token } = req.params;

    const result = await OrganizationService.acceptOrganizationInviteToken(
      token,
      userId,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Update Member Role
 * PATCH /api/organizations/:id/members/:userId/role
 */
export const updateMemberRole = async (req, res, next) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const actorId = req.user.id || req.user._id;
    const orgId = req.params.id;
    const targetUserId = req.params.userId;
    const { role, reason } = req.body;

    if (!role) {
      return next(new ValidationError("Role is required."));
    }

    const result = await OrganizationService.updateMemberRole(
      actorId,
      orgId,
      targetUserId,
      role,
      reason,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Deactivate Member
 * PATCH /api/organizations/:id/members/:userId/deactivate
 */
export const deactivateMember = async (req, res, next) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const actorId = req.user.id || req.user._id;
    const orgId = req.params.id;
    const targetUserId = req.params.userId;
    const { reason } = req.body;

    const result = await OrganizationService.deactivateMemberInOrganization(
      actorId,
      orgId,
      targetUserId,
      reason,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Reactivate Member
 * PATCH /api/organizations/:id/members/:userId/reactivate
 */
export const reactivateMember = async (req, res, next) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const actorId = req.user.id || req.user._id;
    const orgId = req.params.id;
    const targetUserId = req.params.userId;

    const result = await OrganizationService.reactivateMemberInOrganization(
      actorId,
      orgId,
      targetUserId,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Update Member Capacity
 * PATCH /api/organizations/:id/members/:userId/capacity
 */
export const updateMemberCapacity = async (req, res, next) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const actorId = req.user.id || req.user._id;
    const orgId = req.params.id;
    const targetUserId = req.params.userId;

    const result = await OrganizationService.updateMemberCapacity(
      actorId,
      orgId,
      targetUserId,
      req.body,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Get Member Role History
 * GET /api/organizations/:id/members/:userId/role-history
 */
export const getMemberRoleHistory = async (req, res, next) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const actorId = req.user.id || req.user._id;
    const orgId = req.params.id;
    const targetUserId = req.params.userId;

    const result = await OrganizationService.getMemberRoleHistory(
      actorId,
      orgId,
      targetUserId,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Remove Member from Organization
 * DELETE /api/organizations/:id/members/:userId
 */
export const removeMember = async (req, res, next) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const actorId = req.user.id || req.user._id;
    const orgId = req.params.id;
    const targetUserId = req.params.userId;

    const result = await OrganizationService.removeMemberFromOrganization(
      actorId,
      orgId,
      targetUserId,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};

/**
 * ✅ Get Paginated Audit Logs
 * GET /api/organizations/:id/audit-log
 */
export const getPaginatedAuditLogs = async (req, res, next) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return next(new UnauthorizedError("Authentication failed."));
    }

    const actorId = req.user.id || req.user._id;
    const orgId = req.params.id;

    const result = await OrganizationService.getOrganizationAuditLogsService(
      actorId,
      orgId,
      req.query,
    );

    sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
};
