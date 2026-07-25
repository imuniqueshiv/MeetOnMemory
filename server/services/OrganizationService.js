// server/services/OrganizationService.js
//
// Business logic for organizations — database queries, membership
// management, notifications, and audit logging.  Controllers call
// these functions with plain data (no req/res).

import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import Membership from "../models/membershipModel.js";
import MembershipRequest from "../models/membershipRequestModel.js";
import eventBus from "./eventBus.js";
import AuditService from "./AuditService.js";
import mongoose from "mongoose";
import crypto from "crypto";
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
 * Escape special regex characters to prevent ReDoS attacks
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Validate MongoDB ObjectId
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Whitelist allowed visibility values
 */
const allowedVisibilities = ["public", "private", "invite-only"];
const isValidVisibility = (visibility) =>
  allowedVisibilities.includes(visibility);

const allowedJoinPolicies = ["open", "approval_required", "invite_only"];
const isValidJoinPolicy = (joinPolicy) =>
  allowedJoinPolicies.includes(joinPolicy);

/**
 * Whitelist allowed role values
 */
const allowedRoles = ["admin", "member"]; // eslint-disable-line no-unused-vars

/**
 * Generate a unique slug from organization name
 */
const generateSlug = (name) => {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  const randomSuffix = crypto.randomBytes(3).toString("hex");
  return `${baseSlug}-${randomSuffix}`;
};

const isLegacyMember = (organization, userId) =>
  Array.isArray(organization.members) &&
  organization.members.some(
    (member) => member.toString() === userId.toString(),
  );

const assertDirectJoinAllowed = (organization) => {
  if (
    organization.visibility === "invite-only" ||
    organization.joinPolicy === "invite_only"
  ) {
    throw new ForbiddenError(
      "This organization requires a valid invitation to join.",
    );
  }
  if (organization.visibility !== "public") {
    throw new ForbiddenError(
      "This private organization requires invitation or membership approval.",
    );
  }
  if (organization.joinPolicy === "approval_required") {
    throw new ForbiddenError(
      "This organization requires membership approval before joining.",
    );
  }
};

const joinOrganization = async (userId, organization) => {
  const [membership, pendingRequest] = await Promise.all([
    Membership.findOne({
      user: userId,
      organization: organization._id,
      status: "active",
    }),
    MembershipRequest.findOne({
      user: userId,
      organization: organization._id,
      status: "pending",
    }),
  ]);

  if (membership || isLegacyMember(organization, userId)) {
    await userModel.findByIdAndUpdate(userId, {
      role: membership?.role || "member",
      organization: organization._id,
      hasCompletedOnboarding: true,
    });
    return { alreadyMember: true };
  }

  assertDirectJoinAllowed(organization);

  if (pendingRequest) {
    throw new ConflictError(
      "A membership request for this organization is already pending.",
    );
  }

  try {
    await Membership.create({
      user: userId,
      organization: organization._id,
      role: "member",
      status: "active",
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new ConflictError("You are already a member of this organization.");
    }
    throw error;
  }

  if (!Array.isArray(organization.members)) organization.members = [];
  organization.members.push(userId);
  await organization.save();

  await userModel.findByIdAndUpdate(userId, {
    role: "member",
    organization: organization._id,
    hasCompletedOnboarding: true,
  });

  return { alreadyMember: false };
};

// ═══════════════════════════════════════════════════════════════
// Public service methods
// ═══════════════════════════════════════════════════════════════

/**
 * ✅ Create or Join Organization
 * - If org exists → join as Member
 * - If not → create new org as Admin
 * - Returns the response payload (success, message, userData)
 */
export const createOrJoinOrganization = async (userId, orgName) => {
  // Check if organization already exists (case-insensitive match)
  const escapedOrgName = escapeRegex(orgName);
  let organization = await Organization.findOne({
    name: { $regex: `^${escapedOrgName}$`, $options: "i" },
  });

  let message = "";

  if (organization) {
    // --- Join existing organization ---
    await joinOrganization(userId, organization);

    message = "Joined existing organization successfully.";

    // Notify the organization admin
    if (
      organization.createdBy &&
      organization.createdBy.toString() !== userId.toString()
    ) {
      eventBus.emit("organization.joined", {
        userId,
        organizationId: organization._id,
        organizationName: organization.name,
        adminId: organization.createdBy,
      });
    }
  } else {
    // --- Create new organization ---
    const baseSlug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    const uniqueSlug = baseSlug
      ? `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`
      : `org-${Math.random().toString(36).substring(2, 8)}`;

    organization = await Organization.create({
      name: orgName,
      slug: uniqueSlug,
      owner: userId,
      createdBy: userId,
      members: [userId],
    });

    await userModel.findByIdAndUpdate(userId, {
      role: "admin",
      organization: organization._id,
      hasCompletedOnboarding: true,
    });

    // Log the creation
    AuditService.logAction({
      actorId: userId,
      action: "ORGANIZATION_CREATED",
      entity: "Organization",
      entityId: organization._id,
      organizationId: organization._id,
      details: { name: orgName, slug: uniqueSlug },
    });

    message = "Organization created successfully!";
  }

  // Fetch updated user data (with organization populated)
  const updatedUser = await userModel
    .findById(userId)
    .populate("organization", "name logo");

  // Defensive checks in case something is missing
  const roleStr =
    updatedUser?.role && typeof updatedUser.role === "string"
      ? updatedUser.role.charAt(0).toUpperCase() + updatedUser.role.slice(1)
      : updatedUser?.role || null;

  const orgDoc = updatedUser?.organization
    ? {
        ...updatedUser.organization._doc,
        name:
          typeof updatedUser.organization.name === "string"
            ? updatedUser.organization.name
            : "",
      }
    : null;

  return {
    success: true,
    message,
    userData: {
      ...updatedUser._doc,
      role: roleStr,
      organization: orgDoc,
    },
  };
};

/**
 * ✅ Get All Organizations (For listing)
 * Returns: { success: true, organizations: [...] }
 */
export const getAllOrganizations = async () => {
  const organizations = await Organization.find(
    { visibility: "public" },
    "name _id",
  ).sort({ createdAt: -1 });
  return { success: true, organizations };
};

/**
 * ✅ Join organization by ID (member flow)
 */
export const joinOrganizationById = async (userId, organizationId) => {
  if (!organizationId) {
    throw new ValidationError("organizationId is required.");
  }

  if (!isValidObjectId(organizationId)) {
    throw new ValidationError("Invalid organization ID format.");
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new NotFoundError("Organization not found.");
  }

  await joinOrganization(userId, organization);

  const updatedUser = await userModel
    .findById(userId)
    .populate("organization", "name logo");

  // Notify organization admin
  if (organization.createdBy) {
    eventBus.emit("organization.joined", {
      userId,
      organizationId: organization._id,
      organizationName: organization.name,
      adminId: organization.createdBy,
    });
  }

  return {
    success: true,
    message: "Joined organization successfully.",
    userData: updatedUser,
  };
};

/**
 * ✅ Select organization (for users with multiple orgs)
 */
export const selectOrganization = async (userId, organizationId) => {
  if (!organizationId) {
    throw new ValidationError("organizationId is required.");
  }

  if (!isValidObjectId(organizationId)) {
    throw new ValidationError("Invalid organization ID format.");
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new NotFoundError("Organization not found.");
  }

  // Get user's membership role in the selected organization
  const membership = await Membership.findOne({
    user: userId,
    organization: organization._id,
    status: "active",
  });

  if (!membership && !isLegacyMember(organization, userId)) {
    throw new ForbiddenError("You are not a member of this organization.");
  }

  const userRole = membership ? membership.role : "member";

  // Update user's selected organization and role
  await userModel.findByIdAndUpdate(userId, {
    organization: organization._id,
    role: userRole,
    hasCompletedOnboarding: true,
  });

  const updatedUser = await userModel
    .findById(userId)
    .populate("organization", "name logo");

  return {
    success: true,
    message: "Organization selected successfully.",
    userData: updatedUser,
  };
};

/**
 * ✅ Get organization members for the current user's organization
 */
export const getOrganizationMembers = async (userId) => {
  const user = await userModel.findById(userId);
  if (!user || !user.organization) {
    throw new ValidationError("User is not part of an organization.");
  }

  const organization = await Organization.findById(user.organization).populate({
    path: "members",
    select: "name email role createdAt isAccountVerified",
  });

  if (!organization) {
    throw new NotFoundError("Organization not found.");
  }

  return {
    success: true,
    members: organization.members,
    organizationName: organization.name,
  };
};

/**
 * ✅ Get public organization profile by slug
 */
export const getPublicOrganizationBySlug = async (slug) => {
  if (!slug) {
    throw new ValidationError("Slug is required.");
  }

  // Find organization by slug - only select public fields
  const organization = await Organization.findOne(
    { slug },
    "name slug description logo visibility createdAt metadata",
  );

  if (!organization) {
    throw new NotFoundError("Organization not found.");
  }

  // Get member count from Membership model (without exposing member details)
  const memberCount = await Membership.countDocuments({
    organization: organization._id,
    status: "active",
  });

  // Extract public metadata fields (website, social links, tags)
  const metadata = organization.metadata || {};
  const publicData = {
    _id: organization._id,
    name: organization.name,
    slug: organization.slug,
    description: organization.description,
    logo: organization.logo,
    visibility: organization.visibility,
    createdAt: organization.createdAt,
    memberCount,
    website: metadata.website || null,
    socialLinks: metadata.socialLinks || null,
    tags: metadata.tags || [],
  };

  return {
    success: true,
    organization: publicData,
  };
};

/**
 * ✅ Browse public organizations with pagination and filters
 */
export const browsePublicOrganizations = async ({
  page = 1,
  limit = 12,
  search = "",
  sortBy = "createdAt",
  filter = "all",
}) => {
  // Build base query - only public organizations
  const baseQuery = { visibility: "public" };

  // Add search filter if provided
  let searchQuery = { ...baseQuery };
  if (search && search.trim()) {
    const escapedSearch = escapeRegex(search.trim());
    const searchRegex = new RegExp(escapedSearch, "i");

    searchQuery = {
      ...baseQuery,
      $or: [
        { name: searchRegex },
        { slug: searchRegex },
        { description: searchRegex },
      ],
    };
  }

  // Build sort object
  let sortObj = {};
  switch (sortBy) {
    case "name":
      sortObj = { name: 1 };
      break;

    case "members":
      sortObj = { "members.length": -1 };
      break;

    case "createdAt":
    default:
      sortObj = { createdAt: -1 };
      break;
  }

  // Apply additional filters
  let finalQuery = { ...searchQuery };

  if (filter === "recent") {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    finalQuery = {
      ...searchQuery,
      createdAt: { $gte: thirtyDaysAgo },
    };
  }

  // Execute query with pagination
  const skip = (page - 1) * limit;

  const [organizations, total] = await Promise.all([
    Organization.find(finalQuery)
      .select(
        "name slug description logo visibility createdAt members metadata",
      )
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean(),

    Organization.countDocuments(finalQuery),
  ]);

  // Calculate member counts for each organization
  const organizationsWithCounts = organizations.map((org) => ({
    ...org,
    memberCount: org.members ? org.members.length : 0,
  }));

  return {
    success: true,
    organizations: organizationsWithCounts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };
};

/**
 * ✅ Search organizations (public only)
 */
export const searchOrganizations = async (q, page = 1, limit = 12) => {
  const escapedQuery = escapeRegex(q.trim());
  const searchRegex = new RegExp(escapedQuery, "i");
  const skip = (page - 1) * limit;

  // Search in public organizations only
  const query = {
    visibility: "public",
    $or: [
      { name: searchRegex },
      { slug: searchRegex },
      { description: searchRegex },
    ],
  };

  const [organizations, total] = await Promise.all([
    Organization.find(query)
      .select(
        "name slug description logo visibility createdAt members metadata",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Organization.countDocuments(query),
  ]);

  // Calculate member counts
  const organizationsWithCounts = organizations.map((org) => ({
    ...org,
    memberCount: org.members ? org.members.length : 0,
  }));

  return {
    success: true,
    organizations: organizationsWithCounts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };
};

/**
 * ✅ Get user's joined organizations
 */
export const getUserOrganizations = async (userId) => {
  const memberships = await Membership.find({
    user: userId,
    status: "active",
  })
    .populate(
      "organization",
      "name slug description logo visibility members updatedAt",
    )
    .lean();

  const organizations = memberships
    .filter((m) => m.organization)
    .map((m) => ({
      ...m.organization,
      role: m.role,
      memberCount: m.organization.members ? m.organization.members.length : 0,
      lastActive: m.organization.updatedAt || new Date(),
    }));

  return { success: true, organizations };
};

/**
 * ✅ Create Organization (New version)
 */
export const createOrganization = async (
  userId,
  { name, description, logo, visibility, joinPolicy, metadata },
) => {
  if (!name || !name.trim()) {
    throw new ValidationError("Organization name is required.");
  }

  const orgName = name.trim();

  if (visibility && !isValidVisibility(visibility)) {
    throw new ValidationError("Invalid visibility value.");
  }
  if (joinPolicy && !isValidJoinPolicy(joinPolicy)) {
    throw new ValidationError("Invalid join policy.");
  }

  // Check if organization with same name exists (case-insensitive)
  const escapedOrgName = escapeRegex(orgName);
  const existingOrg = await Organization.findOne({
    name: { $regex: `^${escapedOrgName}$`, $options: "i" },
  });

  if (existingOrg) {
    throw new ConflictError("Organization with this name already exists.");
  }

  // Generate unique slug
  const slug = generateSlug(orgName);

  // Create organization
  const organization = await Organization.create({
    name: orgName,
    slug,
    description: description || "",
    logo: logo || "",
    visibility: visibility || "private",
    joinPolicy: joinPolicy || "open",
    owner: userId,
    members: [userId],
    metadata: metadata || {},
  });

  // Create admin membership for the owner
  await Membership.create({
    user: userId,
    organization: organization._id,
    role: "admin",
    status: "active",
  });

  // Update user model for backward compatibility
  await userModel.findByIdAndUpdate(userId, {
    role: "admin",
    organization: organization._id,
    hasCompletedOnboarding: true,
  });

  return {
    success: true,
    message: "Organization created successfully.",
    organization,
  };
};

/**
 * ✅ Get All Organizations (Paginated)
 */
export const getOrganizations = async (visibility, page = 1, limit = 20) => {
  // Validate visibility value
  const validVisibility =
    visibility && isValidVisibility(visibility)
      ? allowedVisibilities.find((v) => v === visibility)
      : null;
  if (visibility && !validVisibility) {
    throw new ValidationError("Invalid visibility value.");
  }

  // Validate and sanitize pagination parameters
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

  // Build safe query filter with only validated values
  const safeFilter = {};
  if (validVisibility) {
    safeFilter.visibility = validVisibility;
  }

  const organizations = await Organization.find(safeFilter)
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .select("name slug description logo visibility owner createdAt")
    .lean();

  const total = await Organization.countDocuments(safeFilter);

  return {
    success: true,
    organizations,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };
};

/**
 * ✅ Get Organization by ID or Slug
 */
export const getOrganizationById = async (idOrSlug) => {
  // Validate input - only allow alphanumeric, hyphens, and underscores for slug
  const slugRegex = /^[a-zA-Z0-9-_]+$/;
  if (!slugRegex.test(idOrSlug)) {
    throw new ValidationError("Invalid organization identifier.");
  }

  // Try as ObjectId first, then as slug
  const isObjectIdVal = isValidObjectId(idOrSlug);
  const query = isObjectIdVal
    ? { _id: new mongoose.Types.ObjectId(String(idOrSlug)) }
    : { slug: String(idOrSlug) };

  const organization = await Organization.findOne(query)
    .select("name slug description logo visibility owner createdAt")
    .populate("owner", "name email")
    .lean();

  if (!organization) {
    throw new NotFoundError("Organization not found.");
  }

  return { success: true, organization };
};

/**
 * ✅ Update Organization
 */
export const updateOrganization = async (
  userId,
  id,
  { name, description, logo, visibility, joinPolicy, metadata },
) => {
  if (!isValidObjectId(id)) {
    throw new ValidationError("Invalid organization ID.");
  }

  const cleanId = new mongoose.Types.ObjectId(String(id));

  // Validate visibility if provided
  if (visibility && !isValidVisibility(visibility)) {
    throw new ValidationError("Invalid visibility value.");
  }
  if (joinPolicy && !isValidJoinPolicy(joinPolicy)) {
    throw new ValidationError("Invalid join policy.");
  }

  const cleanVisibility =
    visibility && isValidVisibility(visibility)
      ? allowedVisibilities.find((v) => v === visibility)
      : undefined;
  const cleanJoinPolicy =
    joinPolicy && isValidJoinPolicy(joinPolicy)
      ? allowedJoinPolicies.find((policy) => policy === joinPolicy)
      : undefined;

  const organization = await Organization.findById(cleanId);

  if (!organization) {
    throw new NotFoundError("Organization not found.");
  }

  // Check if user is owner or admin
  const membership = await Membership.findOne({
    user: userId,
    organization: cleanId,
    role: "admin",
    status: "active",
  }).lean();

  if (!membership && organization.owner.toString() !== userId.toString()) {
    throw new ForbiddenError("Not authorized to update this organization.");
  }

  // Update fields with sanitization
  if (name) organization.name = String(name).trim().substring(0, 100);
  if (description !== undefined)
    organization.description = String(description).trim().substring(0, 500);
  if (logo !== undefined)
    organization.logo = String(logo).trim().substring(0, 500);
  if (cleanVisibility) organization.visibility = cleanVisibility;
  if (cleanJoinPolicy) organization.joinPolicy = cleanJoinPolicy;
  if (metadata)
    organization.metadata = typeof metadata === "object" ? metadata : {};

  await organization.save();

  return {
    success: true,
    message: "Organization updated successfully.",
    organization,
  };
};

/**
 * ✅ Delete Organization
 */
export const deleteOrganization = async (userId, id) => {
  if (!isValidObjectId(id)) {
    throw new ValidationError("Invalid organization ID.");
  }

  const cleanId = new mongoose.Types.ObjectId(String(id));

  const organization = await Organization.findById(cleanId);

  if (!organization) {
    throw new NotFoundError("Organization not found.");
  }

  // Only owner can delete
  if (organization.owner.toString() !== userId.toString()) {
    throw new ForbiddenError("Not authorized to delete this organization.");
  }

  // Delete all memberships
  await Membership.deleteMany({ organization: cleanId });

  // Delete organization
  await Organization.findByIdAndDelete(cleanId);

  return {
    success: true,
    message: "Organization deleted successfully.",
  };
};

/**
 * ✅ Get Organization Members by ID
 */
export const getOrganizationMembersById = async (userId, id) => {
  if (!isValidObjectId(id)) {
    throw new ValidationError("Invalid organization ID.");
  }

  const cleanId = new mongoose.Types.ObjectId(String(id));

  const organization = await Organization.findById(cleanId);

  if (!organization) {
    throw new NotFoundError("Organization not found.");
  }

  // Check if user is a member
  const membership = await Membership.findOne({
    user: userId,
    organization: cleanId,
    status: "active",
  }).lean();

  if (!membership) {
    throw new ForbiddenError("Not a member of this organization.");
  }

  // Get all active memberships with user details
  const memberships = await Membership.find({
    organization: cleanId,
    status: "active",
  })
    .populate("user", "name email profilePic isAccountVerified createdAt")
    .sort({ joinedAt: -1 })
    .lean();

  const members = memberships.map((m) => ({
    _id: m.user._id,
    name: m.user.name,
    email: m.user.email,
    profilePic: m.user.profilePic,
    isAccountVerified: m.user.isAccountVerified,
    role: m.role,
    joinedAt: m.joinedAt,
  }));

  return {
    success: true,
    members,
    organizationName: organization.name,
  };
};
