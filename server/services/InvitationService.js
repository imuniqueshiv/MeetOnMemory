// server/services/InvitationService.js
//
// Business logic for invitations — create, accept, reject, revoke,
// resend, and expire.  Controllers call these functions with plain
// data (no req/res).

import Invitation from "../models/invitationModel.js";
import Membership from "../models/membershipModel.js";
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import crypto from "crypto";
import mongoose from "mongoose";
import EmailService from "./EmailService.js";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from "../utils/errors.js";

// ═══════════════════════════════════════════════════════════════
// Private helpers
// ═══════════════════════════════════════════════════════════════

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
 * Check if a user is admin or owner of the given organization.
 * Returns true if authorized, false otherwise.
 */
const isAdminOrOwner = async (userId, organization) => {
  const membership = await Membership.findOne({
    user: userId,
    organization: organization._id,
    role: "admin",
    status: "active",
  }).lean();

  const isOwner = organization.owner.toString() === userId.toString();
  return !!(membership || isOwner);
};

// ═══════════════════════════════════════════════════════════════
// Public service methods
// ═══════════════════════════════════════════════════════════════

/**
 * ✅ Create Invitation
 */
export const createInvitation = async (
  userId,
  { organizationId, email, role, message: inviteMessage, expiresIn },
  { origin, inviterName },
) => {
  if (!organizationId || !email) {
    throw new ValidationError("Organization ID and email are required.");
  }

  // Validate organizationId
  if (!isValidObjectId(organizationId)) {
    throw new ValidationError("Invalid organization ID.");
  }

  const cleanOrganizationId = new mongoose.Types.ObjectId(
    String(organizationId),
  );

  // Validate and sanitize email
  const sanitizedEmail = sanitizeEmail(email);
  if (!sanitizedEmail) {
    throw new ValidationError("Invalid email address.");
  }

  // Validate role if provided
  if (role && !isValidRole(role)) {
    throw new ValidationError("Invalid role. Must be 'admin' or 'member'.");
  }

  const cleanRole =
    role && isValidRole(role) ? allowedRoles.find((r) => r === role) : "member";

  // Check if organization exists
  const organization = await Organization.findById(cleanOrganizationId);

  if (!organization) {
    throw new NotFoundError("Organization not found.");
  }

  // Check if user is admin or owner
  if (!(await isAdminOrOwner(userId, organization))) {
    throw new ForbiddenError("Not authorized to create invitations.");
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
      throw new ValidationError(
        "User is already a member of this organization.",
      );
    }
  }

  // Check if there's a pending invitation for this email
  const existingInvitation = await Invitation.findOne({
    email: sanitizedEmail,
    organization: cleanOrganizationId,
    status: "pending",
  }).lean();

  if (existingInvitation) {
    throw new ConflictError(
      "Pending invitation already exists for this email.",
    );
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
    message: inviteMessage
      ? String(inviteMessage).trim().substring(0, 500)
      : "",
  };

  const invitation = await Invitation.create(invitationData);

  // Send invitation email
  const inviteLink = `${origin || "http://localhost:5173"}/join-organization?token=${invitation.token}`;
  await EmailService.sendInvitation({
    to: sanitizedEmail,
    organizationName: organization.name,
    invitedBy: inviterName || "Admin",
    inviteLink,
  });

  return {
    success: true,
    message: "Invitation created successfully.",
    invitation,
  };
};

/**
 * ✅ Get Organization Invitations
 */
export const getOrganizationInvitations = async (
  userId,
  organizationId,
  status,
) => {
  // Validate organizationId
  if (!isValidObjectId(organizationId)) {
    throw new ValidationError("Invalid organization ID.");
  }

  const cleanOrganizationId = new mongoose.Types.ObjectId(
    String(organizationId),
  );

  // Validate status if provided
  if (status && !isValidStatus(status)) {
    throw new ValidationError("Invalid status value.");
  }

  const cleanStatus =
    status && isValidStatus(status)
      ? allowedStatuses.find((s) => s === status)
      : undefined;

  const organization = await Organization.findById(cleanOrganizationId);

  if (!organization) {
    throw new NotFoundError("Organization not found.");
  }

  // Check if user is admin or owner
  if (!(await isAdminOrOwner(userId, organization))) {
    throw new ForbiddenError("Not authorized to view invitations.");
  }

  const filter = { organization: cleanOrganizationId };
  if (cleanStatus) {
    filter.status = cleanStatus;
  }

  const invitations = await Invitation.find(filter)
    .populate("invitedBy", "name email")
    .sort({ createdAt: -1 })
    .lean();

  return { success: true, invitations };
};

/**
 * ✅ Get User's Invitations
 */
export const getUserInvitations = async (userId) => {
  const user = await userModel.findById(userId);

  if (!user) {
    throw new NotFoundError("User not found.");
  }

  const invitations = await Invitation.find({
    email: user.email,
    status: "pending",
    expiresAt: { $gt: new Date() },
  })
    .populate("organization", "name slug description logo")
    .populate("invitedBy", "name email")
    .sort({ createdAt: -1 });

  return { success: true, invitations };
};

/**
 * ✅ Accept Invitation
 */
export const acceptInvitation = async (userId, token) => {
  const invitation = await Invitation.findOne({ token }).populate(
    "organization",
  );

  if (!invitation) {
    throw new NotFoundError("Invitation not found.");
  }

  if (invitation.status !== "pending") {
    throw new ValidationError("Invitation is not in pending status.");
  }

  if (invitation.expiresAt < new Date()) {
    invitation.status = "expired";
    await invitation.save();
    throw new ValidationError("Invitation has expired.");
  }

  // Verify email matches
  const user = await userModel.findById(userId);

  if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new ForbiddenError("Invitation is not for this user.");
  }

  // Check if user already has an active membership
  const existingMembership = await Membership.findOne({
    user: userId,
    organization: invitation.organization._id,
    status: "active",
  });

  if (existingMembership) {
    throw new ValidationError("Already a member of this organization.");
  }

  // Update invitation status
  invitation.status = "accepted";
  invitation.acceptedBy = userId;
  invitation.acceptedAt = new Date();
  await invitation.save();

  // Create membership
  const newMembership = await Membership.create({
    user: userId,
    organization: invitation.organization._id,
    role: invitation.role,
    status: "active",
  });

  // Update user model for backward compatibility
  await userModel.findByIdAndUpdate(userId, {
    role: invitation.role,
    organization: invitation.organization._id,
    hasCompletedOnboarding: true,
  });

  return {
    success: true,
    message: "Invitation accepted successfully.",
    invitation,
    membership: newMembership,
  };
};

/**
 * ✅ Reject Invitation
 */
export const rejectInvitation = async (userId, token) => {
  const invitation = await Invitation.findOne({ token });

  if (!invitation) {
    throw new NotFoundError("Invitation not found.");
  }

  if (invitation.status !== "pending") {
    throw new ValidationError("Invitation is not in pending status.");
  }

  // Verify email matches
  const user = await userModel.findById(userId);

  if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new ForbiddenError("Invitation is not for this user.");
  }

  // Update invitation status
  invitation.status = "declined";
  await invitation.save();

  return {
    success: true,
    message: "Invitation declined successfully.",
    invitation,
  };
};

/**
 * ✅ Revoke Invitation
 */
export const revokeInvitation = async (userId, invitationId) => {
  if (!isValidObjectId(invitationId)) {
    throw new ValidationError("Invalid invitation ID.");
  }

  const cleanInvitationId = new mongoose.Types.ObjectId(String(invitationId));
  const invitation =
    await Invitation.findById(cleanInvitationId).populate("organization");

  if (!invitation) {
    throw new NotFoundError("Invitation not found.");
  }

  // Check if user is admin or owner
  if (!(await isAdminOrOwner(userId, invitation.organization))) {
    throw new ForbiddenError("Not authorized to revoke invitations.");
  }

  if (invitation.status !== "pending") {
    throw new ValidationError("Can only cancel pending invitations.");
  }

  invitation.status = "cancelled";
  await invitation.save();

  return {
    success: true,
    message: "Invitation cancelled successfully.",
    invitation,
  };
};

/**
 * ✅ Get Invitation by Token
 */
export const getInvitationByToken = async (token) => {
  const invitation = await Invitation.findOne({ token })
    .populate("organization", "name slug description logo")
    .populate("invitedBy", "name email");

  if (!invitation) {
    throw new NotFoundError("Invitation not found.");
  }

  if (invitation.status !== "pending") {
    throw new ValidationError("Invitation is not in pending status.");
  }

  if (invitation.expiresAt < new Date()) {
    invitation.status = "expired";
    await invitation.save();
    throw new ValidationError("Invitation has expired.");
  }

  return { success: true, invitation };
};

/**
 * ✅ Resend Invitation
 */
export const resendInvitation = async (
  userId,
  invitationId,
  { origin, inviterName },
) => {
  if (!isValidObjectId(invitationId)) {
    throw new ValidationError("Invalid invitation ID.");
  }

  const cleanInvitationId = new mongoose.Types.ObjectId(String(invitationId));
  const invitation =
    await Invitation.findById(cleanInvitationId).populate("organization");

  if (!invitation) {
    throw new NotFoundError("Invitation not found.");
  }

  // Check if user is admin or owner
  if (!(await isAdminOrOwner(userId, invitation.organization))) {
    throw new ForbiddenError("Not authorized to resend invitations.");
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
  const inviteLink = `${origin || "http://localhost:5173"}/join-organization?token=${newToken}`;
  await EmailService.sendInvitation({
    to: invitation.email,
    organizationName: invitation.organization.name,
    invitedBy: inviterName || "Admin",
    inviteLink,
  });

  return {
    success: true,
    message: "Invitation resent successfully.",
    invitation,
  };
};

/**
 * ✅ Expire Invitation Manually
 */
export const expireInvitation = async (userId, invitationId) => {
  if (!isValidObjectId(invitationId)) {
    throw new ValidationError("Invalid invitation ID.");
  }

  const cleanInvitationId = new mongoose.Types.ObjectId(String(invitationId));
  const invitation =
    await Invitation.findById(cleanInvitationId).populate("organization");

  if (!invitation) {
    throw new NotFoundError("Invitation not found.");
  }

  // Check if user is admin or owner
  if (!(await isAdminOrOwner(userId, invitation.organization))) {
    throw new ForbiddenError("Not authorized to expire invitations.");
  }

  if (invitation.status !== "pending") {
    throw new ValidationError("Can only expire pending invitations.");
  }

  invitation.status = "expired";
  invitation.expiresAt = new Date();
  await invitation.save();

  return {
    success: true,
    message: "Invitation expired successfully.",
    invitation,
  };
};
