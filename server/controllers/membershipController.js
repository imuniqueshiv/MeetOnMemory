// server/controllers/membershipController.js
import Membership from "../models/membershipModel.js";
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

/**
 * ✅ Get User Memberships
 * GET /api/memberships
 */
export const getUserMemberships = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const memberships = await Membership.find({
      user: req.user.id,
      status: "active",
    })
      .populate("organization", "name slug description logo visibility")
      .sort({ joinedAt: -1 });

    sendSuccess(res, { memberships });
  } catch (error) {
    console.error("❌ Error fetching user memberships:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * ✅ Get Organization Memberships
 * GET /api/memberships/organization/:organizationId
 */
export const getOrganizationMemberships = async (req, res) => {
  try {
    const { organizationId } = req.params;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      return sendError(res, 404, "Organization not found.");
    }

    // Check if user is a member
    const membership = await Membership.findOne({
      user: req.user.id,
      organization: organizationId,
      status: "active",
    });

    if (!membership) {
      return sendError(res, 403, "Not a member of this organization.");
    }

    const memberships = await Membership.find({
      organization: organizationId,
      status: "active",
    })
      .populate("user", "name email profilePic isAccountVerified")
      .sort({ joinedAt: -1 });

    sendSuccess(res, { memberships });
  } catch (error) {
    console.error("❌ Error fetching organization memberships:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * ✅ Update Membership Role
 * PATCH /api/memberships/:id/role
 */
export const updateMembershipRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    if (!role || !["admin", "member"].includes(role)) {
      return sendError(res, 400, "Invalid role. Must be 'admin' or 'member'.");
    }

    const membership = await Membership.findById(id).populate("organization");

    if (!membership) {
      return sendError(res, 404, "Membership not found.");
    }

    // Check if requester is admin or owner of the organization
    const requesterMembership = await Membership.findOne({
      user: req.user.id,
      organization: membership.organization._id,
      role: "admin",
      status: "active",
    });

    const isOwner =
      membership.organization.owner.toString() === req.user.id.toString();

    if (!requesterMembership && !isOwner) {
      return sendError(res, 403, "Not authorized to update membership role.");
    }

    // Prevent removing the last admin
    if (membership.role === "admin" && role === "member") {
      const adminCount = await Membership.countDocuments({
        organization: membership.organization._id,
        role: "admin",
        status: "active",
      });

      if (adminCount <= 1) {
        return sendError(res, 400, "Cannot remove the last admin.");
      }
    }

    membership.role = role;
    await membership.save();

    sendSuccess(res, { membership }, "Membership role updated successfully.");
  } catch (error) {
    console.error("❌ Error updating membership role:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * ✅ Remove Membership
 * DELETE /api/memberships/:id
 */
export const removeMembership = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const membership = await Membership.findById(id).populate("organization");

    if (!membership) {
      return sendError(res, 404, "Membership not found.");
    }

    // User can remove themselves
    // Admins can remove other members
    const isSelf = membership.user.toString() === req.user.id.toString();
    const requesterMembership = await Membership.findOne({
      user: req.user.id,
      organization: membership.organization._id,
      role: "admin",
      status: "active",
    });
    const isOwner =
      membership.organization.owner.toString() === req.user.id.toString();

    if (!isSelf && !requesterMembership && !isOwner) {
      return sendError(res, 403, "Not authorized to remove this membership.");
    }

    // Prevent removing the last admin
    if (membership.role === "admin") {
      const adminCount = await Membership.countDocuments({
        organization: membership.organization._id,
        role: "admin",
        status: "active",
      });

      if (adminCount <= 1) {
        return sendError(res, 400, "Cannot remove the last admin.");
      }
    }

    // Update status to removed instead of deleting
    membership.status = "removed";
    await membership.save();

    // Update user model for backward compatibility if it was their primary org
    const targetUserId = isSelf ? req.user.id : membership.user;
    const removedOrgId = membership.organization._id || membership.organization;

    const targetUser = await userModel.findById(targetUserId);
    if (
      targetUser &&
      targetUser.organization &&
      targetUser.organization.toString() === removedOrgId.toString()
    ) {
      await userModel.findByIdAndUpdate(targetUserId, {
        organization: null,
        role: null,
      });
    }

    sendSuccess(res, null, "Membership removed successfully.");
  } catch (error) {
    console.error("❌ Error removing membership:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * ✅ Leave Organization
 * POST /api/memberships/leave/:organizationId
 */
export const leaveOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;

    if (!req.user || !req.user.id) {
      return sendError(res, 401, "Authentication failed.");
    }

    const membership = await Membership.findOne({
      user: req.user.id,
      organization: organizationId,
      status: "active",
    }).populate("organization");

    if (!membership) {
      return sendError(res, 404, "Membership not found.");
    }

    // Prevent owner from leaving (they should transfer ownership first)
    if (membership.organization.owner.toString() === req.user.id.toString()) {
      return sendError(
        res,
        400,
        "Owner cannot leave organization. Transfer ownership first.",
      );
    }

    // Update status to removed
    membership.status = "removed";
    await membership.save();

    // Update user model for backward compatibility
    await userModel.findByIdAndUpdate(req.user.id, {
      organization: null,
      role: null,
    });

    sendSuccess(res, null, "Left organization successfully.");
  } catch (error) {
    console.error("❌ Error leaving organization:", error);
    sendError(res, 500, "Server error");
  }
};
