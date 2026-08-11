// server/controllers/invitationController.js
import Invitation from "../models/invitationModel.js";
import Membership from "../models/membershipModel.js";
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import crypto from "crypto";
import mongoose from "mongoose";
import EmailService from "../services/EmailService.js";
import AuditService from "../services/AuditService.js";

/**
 * Validate MongoDB ObjectId
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Sanitize and validate email (ReDoS-safe)
 */
const sanitizeEmail = (email) => {
  if (!email || typeof email !== "string") return null;
  const sanitized = email.trim().toLowerCase();
  // Simple, ReDoS-safe email validation
  if (sanitized.length > 254) return null; // Max email length
  if (!sanitized.includes("@") || !sanitized.includes(".")) return null;
  const parts = sanitized.split("@");
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (!local || !domain) return null;
  if (local.length > 64) return null; // Max local part length
  if (domain.length > 255) return null; // Max domain length
  if (domain.split(".").length < 2) return null; // At least one dot in domain
  return sanitized;
};

/**
 * Whitelist allowed status values
 */
const allowedStatuses = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "expired",
];
const isValidStatus = (status) => allowedStatuses.includes(status);

/**
 * Whitelist allowed role values
 */
const allowedRoles = ["admin", "member"];
const isValidRole = (role) => allowedRoles.includes(role);

/**
 * Generate unique invitation token
 */
const generateInvitationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * ✅ Create Invitation
 * POST /api/invitations
 */
export const createInvitation = async (req, res) => {
  try {
    const { organizationId, email, role, message, expiresIn } = req.body;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!organizationId || !email) {
      return res.status(400).json({
        success: false,
        message: "Organization ID and email are required.",
      });
    }

    // Validate organizationId
    if (!isValidObjectId(organizationId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid organization ID." });
    }

    const cleanOrganizationId = new mongoose.Types.ObjectId(
      String(organizationId),
    );

    // Validate and sanitize email
    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email address." });
    }

    // Validate role if provided
    if (role && !isValidRole(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be 'admin' or 'member'.",
      });
    }

    const cleanRole =
      role && isValidRole(role)
        ? allowedRoles.find((r) => r === role)
        : "member";

    const userId = req.user.id;

    // Check if organization exists
    const organization = await Organization.findById(cleanOrganizationId);

    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
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
      return res.status(403).json({
        success: false,
        message: "Not authorized to create invitations.",
      });
    }

    // Check if email already has an active membership
    const existingUser = await userModel
      .findOne({ email: sanitizedEmail })
      .lean();
    if (existingUser) {
      const existingMembership = await Membership.findOne({
        user: existingUser._id,
        organization: cleanOrganizationId,
        status: "active",
      }).lean();

      if (existingMembership) {
        return res.status(400).json({
          success: false,
          message: "User is already a member of this organization.",
        });
      }
    }

    // Check if there's a pending invitation for this email
    const existingInvitation = await Invitation.findOne({
      email: sanitizedEmail,
      organization: cleanOrganizationId,
      status: "pending",
    }).lean();

    if (existingInvitation) {
      return res.status(409).json({
        success: false,
        message: "Pending invitation already exists for this email.",
      });
    }

    // Calculate expiration time (default 7 days)
    const expiresAt = new Date();
    const expiresInDays =
      typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : 7;
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create invitation with validated fields
    const invitationData = {
      organization: cleanOrganizationId,
      email: sanitizedEmail,
      invitedBy: userId,
      token: generateInvitationToken(),
      role: cleanRole,
      status: "pending",
      expiresAt,
      message: message ? String(message).trim().substring(0, 500) : "",
    };

    const invitation = await Invitation.create(invitationData);

    // Send invitation email
    const inviteLink = `${req.headers.origin || "http://localhost:5173"}/join-organization?token=${invitation.token}`;
    await EmailService.sendInvitation({
      to: sanitizedEmail,
      organizationName: organization.name,
      invitedBy: req.user.name || "Admin",
      inviteLink,
    });

    res.status(201).json({
      success: true,
      message: "Invitation created successfully.",
      invitation,
    });
  } catch (error) {
    console.error("❌ Error creating invitation:", error);
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Duplicate invitation not allowed." });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get Organization Invitations
 * GET /api/invitations/organization/:organizationId
 */
export const getOrganizationInvitations = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { status } = req.query;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    // Validate organizationId
    if (!isValidObjectId(organizationId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid organization ID." });
    }

    const cleanOrganizationId = new mongoose.Types.ObjectId(
      String(organizationId),
    );

    // Validate status if provided
    if (status && !isValidStatus(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status value." });
    }

    const cleanStatus =
      status && isValidStatus(status)
        ? allowedStatuses.find((s) => s === status)
        : undefined;

    const organization = await Organization.findById(cleanOrganizationId);

    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    // Check if user is admin or owner
    const membership = await Membership.findOne({
      user: req.user.id,
      organization: cleanOrganizationId,
      role: "admin",
      status: "active",
    });

    const isOwner = organization.owner.toString() === req.user.id.toString();

    if (!membership && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view invitations.",
      });
    }

    const filter = { organization: cleanOrganizationId };
    if (cleanStatus) {
      filter.status = cleanStatus;
    }

    const invitations = await Invitation.find(filter)
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, invitations });
  } catch (error) {
    console.error("❌ Error fetching invitations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get User's Invitations
 * GET /api/invitations/user
 */
export const getUserInvitations = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const user = await userModel.findById(req.user.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const invitations = await Invitation.find({
      email: user.email,
      status: "pending",
      expiresAt: { $gt: new Date() },
    })
      .populate("organization", "name slug description logo")
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, invitations });
  } catch (error) {
    console.error("❌ Error fetching user invitations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Accept Invitation
 * POST /api/invitations/:token/accept
 */
export const acceptInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const invitation = await Invitation.findOne({ token }).populate(
      "organization",
    );

    if (!invitation) {
      return res
        .status(404)
        .json({ success: false, message: "Invitation not found." });
    }

    if (invitation.status !== "pending") {
      await AuditService.logAction({
        actorId: req.user.id,
        action: "INVITATION_REJECTED",
        entity: "Invitation",
        entityId: invitation._id,
        organizationId: invitation.organization._id || invitation.organization,
        details: {
          reason: "Invitation is not in pending status.",
          status: invitation.status,
        },
      });
      return res.status(400).json({
        success: false,
        message: "Invitation is not in pending status.",
      });
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = "expired";
      await invitation.save();
      await AuditService.logAction({
        actorId: req.user.id,
        action: "INVITATION_REJECTED",
        entity: "Invitation",
        entityId: invitation._id,
        organizationId: invitation.organization._id || invitation.organization,
        details: { reason: "Invitation has expired." },
      });
      return res
        .status(400)
        .json({ success: false, message: "Invitation has expired." });
    }

    // Verify email matches
    const user = await userModel.findById(req.user.id);

    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      await AuditService.logAction({
        actorId: req.user.id,
        action: "INVITATION_REJECTED",
        entity: "Invitation",
        entityId: invitation._id,
        organizationId: invitation.organization._id || invitation.organization,
        details: { reason: "Invitation is not for this user." },
      });
      return res
        .status(403)
        .json({ success: false, message: "Invitation is not for this user." });
    }

    // Check if user already has an active membership
    const existingMembership = await Membership.findOne({
      user: req.user.id,
      organization: invitation.organization._id,
      status: "active",
    });

    if (existingMembership) {
      return res.status(400).json({
        success: false,
        message: "Already a member of this organization.",
      });
    }

    // Update invitation status
    invitation.status = "accepted";
    invitation.acceptedBy = req.user.id;
    invitation.acceptedAt = new Date();
    await invitation.save();

    // Create membership
    const newMembership = await Membership.create({
      user: req.user.id,
      organization: invitation.organization._id,
      role: invitation.role,
      status: "active",
    });

    // Update user model for backward compatibility
    await userModel.findByIdAndUpdate(req.user.id, {
      role: invitation.role,
      organization: invitation.organization._id,
      hasCompletedOnboarding: true,
    });

    res.status(200).json({
      success: true,
      message: "Invitation accepted successfully.",
      invitation,
      membership: newMembership,
    });
  } catch (error) {
    console.error("❌ Error accepting invitation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Reject Invitation
 * POST /api/invitations/:token/reject
 */
export const rejectInvitation = async (req, res) => {
  try {
    const { token } = req.params;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const invitation = await Invitation.findOne({ token });

    if (!invitation) {
      return res
        .status(404)
        .json({ success: false, message: "Invitation not found." });
    }

    if (invitation.status !== "pending") {
      await AuditService.logAction({
        actorId: req.user.id,
        action: "INVITATION_REJECTED",
        entity: "Invitation",
        entityId: invitation._id,
        organizationId: invitation.organization._id || invitation.organization,
        details: {
          reason: "Invitation is not in pending status.",
          status: invitation.status,
        },
      });
      return res.status(400).json({
        success: false,
        message: "Invitation is not in pending status.",
      });
    }

    // Verify email matches
    const user = await userModel.findById(req.user.id);

    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      await AuditService.logAction({
        actorId: req.user.id,
        action: "INVITATION_REJECTED",
        entity: "Invitation",
        entityId: invitation._id,
        organizationId: invitation.organization._id || invitation.organization,
        details: { reason: "Invitation is not for this user." },
      });
      return res
        .status(403)
        .json({ success: false, message: "Invitation is not for this user." });
    }

    // Update invitation status
    invitation.status = "declined";
    await invitation.save();

    res.status(200).json({
      success: true,
      message: "Invitation declined successfully.",
      invitation,
    });
  } catch (error) {
    console.error("❌ Error rejecting invitation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Revoke Invitation
 * DELETE /api/invitations/:id
 */
export const revokeInvitation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid invitation ID." });
    }

    const cleanInvitationId = new mongoose.Types.ObjectId(String(id));
    const invitation =
      await Invitation.findById(cleanInvitationId).populate("organization");

    if (!invitation) {
      return res
        .status(404)
        .json({ success: false, message: "Invitation not found." });
    }

    // Check if user is admin or owner
    const membership = await Membership.findOne({
      user: req.user.id,
      organization: invitation.organization._id,
      role: "admin",
      status: "active",
    });

    const isOwner =
      invitation.organization.owner.toString() === req.user.id.toString();

    if (!membership && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to revoke invitations.",
      });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Can only cancel pending invitations.",
      });
    }

    invitation.status = "cancelled";
    await invitation.save();

    res.status(200).json({
      success: true,
      message: "Invitation cancelled successfully.",
      invitation,
    });
  } catch (error) {
    console.error("❌ Error revoking invitation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get Invitation by Token
 * GET /api/invitations/:token
 */
export const getInvitationByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await Invitation.findOne({ token })
      .populate("organization", "name slug description logo")
      .populate("invitedBy", "name email");

    if (!invitation) {
      return res
        .status(404)
        .json({ success: false, message: "Invitation not found." });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Invitation is not in pending status.",
      });
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = "expired";
      await invitation.save();
      return res
        .status(400)
        .json({ success: false, message: "Invitation has expired." });
    }

    res.status(200).json({ success: true, invitation });
  } catch (error) {
    console.error("❌ Error fetching invitation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Resend Invitation
 * POST /api/invitations/:id/resend
 */
export const resendInvitation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid invitation ID." });
    }

    const cleanInvitationId = new mongoose.Types.ObjectId(String(id));
    const invitation =
      await Invitation.findById(cleanInvitationId).populate("organization");

    if (!invitation) {
      return res
        .status(404)
        .json({ success: false, message: "Invitation not found." });
    }

    // Check if user is admin or owner
    const membership = await Membership.findOne({
      user: req.user.id,
      organization: invitation.organization._id,
      role: "admin",
      status: "active",
    });

    const isOwner =
      invitation.organization.owner.toString() === req.user.id.toString();

    if (!membership && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to resend invitations.",
      });
    }

    // Generate new token and set expiration to +7 days from now
    const newToken = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    invitation.token = newToken;
    invitation.expiresAt = expiresAt;
    invitation.status = "pending";
    await invitation.save();

    // Send the email
    const inviteLink = `${req.headers.origin || "http://localhost:5173"}/join-organization?token=${newToken}`;
    await EmailService.sendInvitation({
      to: invitation.email,
      organizationName: invitation.organization.name,
      invitedBy: req.user.name || "Admin",
      inviteLink,
    });

    res.status(200).json({
      success: true,
      message: "Invitation resent successfully.",
      invitation,
    });
  } catch (error) {
    console.error("❌ Error resending invitation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Expire Invitation Manually
 * POST /api/invitations/:id/expire
 */
export const expireInvitation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid invitation ID." });
    }

    const cleanInvitationId = new mongoose.Types.ObjectId(String(id));
    const invitation =
      await Invitation.findById(cleanInvitationId).populate("organization");

    if (!invitation) {
      return res
        .status(404)
        .json({ success: false, message: "Invitation not found." });
    }

    // Check if user is admin or owner
    const membership = await Membership.findOne({
      user: req.user.id,
      organization: invitation.organization._id,
      role: "admin",
      status: "active",
    });

    const isOwner =
      invitation.organization.owner.toString() === req.user.id.toString();

    if (!membership && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to expire invitations.",
      });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Can only expire pending invitations.",
      });
    }

    invitation.status = "expired";
    invitation.expiresAt = new Date();
    await invitation.save();

    res.status(200).json({
      success: true,
      message: "Invitation expired successfully.",
      invitation,
    });
  } catch (error) {
    console.error("❌ Error expiring invitation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
