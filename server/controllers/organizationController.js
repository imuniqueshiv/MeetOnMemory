// server/controllers/organizationController.js
//
// HTTP layer only — parse request, call service, send response.
// All business logic lives in server/services/OrganizationService.js.

import * as OrganizationService from "../services/OrganizationService.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

/**
 * ✅ Create or Join Organization
 * - If org exists → join as Member
 * - If not → create new org as Admin
 * - Returns updated user with populated org
 */
export const createOrJoinOrganization = async (req, res) => {
  try {
    const { name } = req.body;

    // Validate authentication
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    // Validate org name
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide an organization name.",
      });
    }

    const result = await OrganizationService.createOrJoinOrganization(
      req.user.id,
      name.trim(),
    );

    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error creating/joining organization:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Get All Organizations (For listing)
 * Returns: { success: true, organizations: [...] }
 */
export const getAllOrganizations = async (req, res) => {
  try {
    const result = await OrganizationService.getAllOrganizations();
    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error fetching organizations:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Join organization by ID (member flow)
 * Body: { organizationId: "<org id>" }
 */
export const joinOrganization = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const result = await OrganizationService.joinOrganizationById(
      req.user.id,
      req.body.organizationId,
    );

    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error joining organization by ID:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Select organization (for users with multiple orgs)
 * Body: { organizationId: "<org id>" }
 */
export const selectOrganization = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const result = await OrganizationService.selectOrganization(
      req.user.id,
      req.body.organizationId,
    );

    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error selecting organization:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Get organization members
 * Returns: { success: true, members: [...] }
 */
export const getOrganizationMembers = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const result = await OrganizationService.getOrganizationMembers(
      req.user.id,
    );

    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error fetching organization members:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Get public organization profile by slug
 * Returns only public information, no private data
 * Route: GET /api/organizations/public/:slug
 */
export const getPublicOrganizationBySlug = async (req, res) => {
  try {
    const result = await OrganizationService.getPublicOrganizationBySlug(
      req.params.slug,
    );

    return sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error fetching public organization:", error);
    return sendError(
      res,
      error.statusCode || 500,
      error.message || "Server error",
    );
  }
};

/**
 * ✅ Browse public organizations with pagination and filters
 */
export const browsePublicOrganizations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const search = req.query.search || "";
    const sortBy = req.query.sortBy || "createdAt";
    const filter = req.query.filter || "all";

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid pagination parameters. Page must be >= 1 and limit must be between 1 and 50.",
      });
    }

    const result = await OrganizationService.browsePublicOrganizations({
      page,
      limit,
      search,
      sortBy,
      filter,
    });

    return sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error browsing public organizations:", error);
    return sendError(
      res,
      error.statusCode || 500,
      error.message || "Server error",
    );
  }
};

/**
 * ✅ Search organizations (public only)
 * Query params: q (search query), page, limit
 * Returns: { success: true, organizations: [...], pagination: {...} }
 */
export const searchOrganizations = async (req, res) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required.",
      });
    }

    if (q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters.",
      });
    }

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters.",
      });
    }

    const result = await OrganizationService.searchOrganizations(
      q,
      page,
      limit,
    );

    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error searching organizations:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Get user's joined organizations
 * GET /api/organizations/user
 */
export const getUserOrganizations = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const result = await OrganizationService.getUserOrganizations(req.user.id);

    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error fetching user organizations:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Create Organization (New version)
 * POST /api/organizations
 */
export const createOrganization = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const result = await OrganizationService.createOrganization(
      req.user.id,
      req.body,
    );

    sendSuccess(res, result, null, 201);
  } catch (error) {
    console.error("❌ Error creating organization:", error);
    if (error.code === 11000) {
      return sendError(res, 409, "Organization slug already exists.");
    }
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Get All Organizations (Paginated)
 * GET /api/organizations
 */
export const getOrganizations = async (req, res) => {
  try {
    const { visibility, page = 1, limit = 20 } = req.query;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const result = await OrganizationService.getOrganizations(
      req.user.id,
      visibility,
      page,
      limit,
    );

    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error fetching organizations:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Get Organization by ID or Slug
 * GET /api/organizations/:idOrSlug
 */
export const getOrganizationById = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const result = await OrganizationService.getOrganizationById(
      req.params.idOrSlug,
      req.user.id,
    );

    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error fetching organization:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Get Organization Settings
 * GET /api/organizations/current/settings
 */
export const getOrganizationSettings = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const orgIdOrSlug = req.query.orgId || req.params.id || null;
    const result = await OrganizationService.getOrganizationSettings(
      req.user.id,
      orgIdOrSlug,
    );

    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error fetching organization settings:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Update Organization
 * PUT /api/organizations/:id
 */
export const updateOrganization = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const result = await OrganizationService.updateOrganization(
      req.user.id,
      req.params.id,
      req.body,
    );

    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error updating organization:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Delete Organization
 * DELETE /api/organizations/:id
 */
export const deleteOrganization = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const result = await OrganizationService.deleteOrganization(
      req.user.id,
      req.params.id,
    );

    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error deleting organization:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Get Organization Members by ID
 * GET /api/organizations/:id/members
 */
export const getOrganizationMembersById = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const result = await OrganizationService.getOrganizationMembersById(
      req.user.id,
      req.params.id,
    );

    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error fetching organization members:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Get Organization Leaderboard
 * GET /api/organizations/:id/leaderboard
 */
export const getOrganizationLeaderboard = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const orgId =
      req.params.id ||
      (req.user.organization ? req.user.organization.toString() : null);
    if (!orgId) {
      return sendError(res, 400, "Organization ID is required.");
    }

    const result = await OrganizationService.getOrganizationLeaderboard(
      req.user.id,
      orgId,
    );

    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error fetching organization leaderboard:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Invite Member to Organization
 * POST /api/organizations/:id/invite
 */
export const inviteMember = async (req, res) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return sendError(res, 401, "Authentication failed.");
    }

    const userId = req.user.id || req.user._id;
    const orgId = req.params.id;
    const { email, role, message } = req.body;

    if (!email) {
      return sendError(res, 400, "Email address is required.");
    }

    const result = await OrganizationService.inviteMemberToOrganization(
      userId,
      orgId,
      { email, role, message },
    );

    sendSuccess(res, result, null, 201);
  } catch (error) {
    console.error("❌ Error inviting member:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Accept Invite Token
 * POST /api/organizations/invite/:token/accept
 */
export const acceptInviteToken = async (req, res) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return sendError(res, 401, "Authentication failed.");
    }

    const userId = req.user.id || req.user._id;
    const { token } = req.params;

    const result = await OrganizationService.acceptOrganizationInviteToken(
      token,
      userId,
    );

    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error accepting invite:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Update Member Role
 * PATCH /api/organizations/:id/members/:userId/role
 */
export const updateMemberRole = async (req, res) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return sendError(res, 401, "Authentication failed.");
    }

    const actorId = req.user.id || req.user._id;
    const orgId = req.params.id;
    const targetUserId = req.params.userId;
    const { role } = req.body;

    if (!role) {
      return sendError(res, 400, "Role is required.");
    }

    const result = await OrganizationService.updateMemberRole(
      actorId,
      orgId,
      targetUserId,
      role,
    );

    sendSuccess(res, result);
  } catch (error) {
    console.error("❌ Error updating member role:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Remove Member from Organization
 * DELETE /api/organizations/:id/members/:userId
 */
export const removeMember = async (req, res) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return sendError(res, 401, "Authentication failed.");
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
    console.error("❌ Error removing member:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};

/**
 * ✅ Get Paginated Audit Logs
 * GET /api/organizations/:id/audit-log
 */
export const getPaginatedAuditLogs = async (req, res) => {
  try {
    if (!req.user || (!req.user.id && !req.user._id)) {
      return sendError(res, 401, "Authentication failed.");
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
    console.error("❌ Error fetching audit logs:", error);
    sendError(res, error.statusCode || 500, error.message || "Server error");
  }
};
