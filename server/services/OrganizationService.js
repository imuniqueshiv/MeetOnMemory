// server/services/OrganizationService.js
//
// Business logic for organizations — database queries, membership
// management, notifications, and audit logging.  Controllers call
// these functions with plain data (no req/res).

import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import Membership from "../models/membershipModel.js";
import MembershipRequest from "../models/membershipRequestModel.js";
import Invitation from "../models/invitationModel.js";
import AuditLog from "../models/auditLogModel.js";
import EmailService from "./EmailService.js";
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
import { normalizeImageUrl } from "../utils/imageUrl.js";

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

    // Create admin membership for the creator (RBAC); unique index prevents duplicates
    try {
      await Membership.create({
        user: userId,
        organization: organization._id,
        role: "admin",
        status: "active",
      });
    } catch (error) {
      // Roll back the org if membership creation fails to avoid inconsistent state
      await Organization.findByIdAndDelete(organization._id);
      if (error.code === 11000) {
        throw new ConflictError(
          "You are already a member of this organization.",
        );
      }
      throw error;
    }

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
    { slug, visibility: "public" },
    "name slug description logo bannerUrl visibility createdAt metadata",
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
  const logoUrl = organization.logo || "";
  const publicData = {
    _id: organization._id,
    name: organization.name,
    slug: organization.slug,
    description: organization.description,
    logo: logoUrl,
    logoUrl,
    bannerUrl: organization.bannerUrl || "",
    visibility: organization.visibility,
    createdAt: organization.createdAt,
    memberCount,
    website: metadata.website || organization.website || null,
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
        "name slug description logo bannerUrl visibility createdAt members metadata",
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
        "name slug description logo bannerUrl visibility createdAt members metadata",
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
      "name slug description logo bannerUrl visibility members updatedAt",
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
  {
    name,
    description,
    logo,
    logoUrl,
    bannerUrl,
    visibility,
    joinPolicy,
    metadata,
  },
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

  const logoInput = logoUrl !== undefined ? logoUrl : logo;
  let normalizedLogo = "";
  if (
    logoInput !== undefined &&
    logoInput !== null &&
    String(logoInput).trim()
  ) {
    const result = normalizeImageUrl(logoInput, "Logo URL");
    if (!result.ok) throw new ValidationError(result.message);
    normalizedLogo = result.value || "";
  }

  let normalizedBanner = "";
  if (
    bannerUrl !== undefined &&
    bannerUrl !== null &&
    String(bannerUrl).trim()
  ) {
    const result = normalizeImageUrl(bannerUrl, "Banner URL");
    if (!result.ok) throw new ValidationError(result.message);
    normalizedBanner = result.value || "";
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
    logo: normalizedLogo,
    bannerUrl: normalizedBanner,
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
export const getOrganizations = async (
  userId,
  visibility,
  page = 1,
  limit = 20,
) => {
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

  // Build safe query filter
  const safeFilter = {};

  if (validVisibility) {
    // Specific visibility requested — filter by it directly
    safeFilter.visibility = validVisibility;
  } else {
    // No visibility filter: show public orgs + orgs where user is member/owner
    const userMemberships = await Membership.find({
      user: userId,
      status: "active",
    })
      .select("organization")
      .lean();

    const memberOrgIds = userMemberships
      .map((m) => m.organization)
      .filter(Boolean);

    safeFilter.$or = [
      { visibility: "public" },
      { owner: new mongoose.Types.ObjectId(String(userId)) },
      ...(memberOrgIds.length > 0
        ? [
            {
              _id: {
                $in: memberOrgIds.map(
                  (id) => new mongoose.Types.ObjectId(String(id)),
                ),
              },
            },
          ]
        : []),
    ];
  }

  const organizations = await Organization.find(safeFilter)
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .select("name slug description logo bannerUrl visibility owner createdAt")
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
 * ✅ Get Organization Settings for current user's org (or specified org)
 */
export const getOrganizationSettings = async (userId, orgIdOrSlug = null) => {
  let targetOrgId = orgIdOrSlug;

  if (!targetOrgId) {
    const user = await userModel.findById(userId);
    if (!user || !user.organization) {
      throw new ValidationError("User is not part of an organization.");
    }
    targetOrgId = user.organization;
  }

  const isObjectIdVal = isValidObjectId(targetOrgId);
  const query = isObjectIdVal
    ? { _id: new mongoose.Types.ObjectId(String(targetOrgId)) }
    : { slug: String(targetOrgId) };

  const organization = await Organization.findOne(query)
    .populate("owner", "name email profilePic")
    .lean();

  if (!organization) {
    throw new NotFoundError("Organization not found.");
  }

  // Check user membership and role
  const membership = await Membership.findOne({
    user: userId,
    organization: organization._id,
    status: "active",
  }).lean();

  const isOwner = organization.owner?._id
    ? organization.owner._id.toString() === userId.toString()
    : organization.owner?.toString() === userId.toString();

  if (!membership && !isOwner && !isLegacyMember(organization, userId)) {
    throw new ForbiddenError(
      "Not authorized to view settings for this organization.",
    );
  }

  const userRole = isOwner
    ? "owner"
    : membership?.role
      ? membership.role
      : "member";

  const canEdit = userRole === "owner" || userRole === "admin";

  const memberCount = await Membership.countDocuments({
    organization: organization._id,
    status: "active",
  });

  return {
    success: true,
    organization: {
      _id: organization._id,
      name: organization.name,
      slug: organization.slug,
      description: organization.description || "",
      about: organization.about || "",
      website: organization.website || "",
      contactEmail: organization.contactEmail || "",
      industry: organization.industry || "",
      location: organization.location || "",
      logo: organization.logo || "",
      logoUrl: organization.logo || "",
      bannerUrl: organization.bannerUrl || "",
      visibility: organization.visibility || "private",
      joinPolicy: organization.joinPolicy || "open",
      owner: organization.owner,
      memberCount:
        memberCount || (organization.members ? organization.members.length : 1),
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      metadata: organization.metadata || {},
    },
    userRole,
    canEdit,
  };
};

/**
 * ✅ Get Organization by ID or Slug
 */
export const getOrganizationById = async (idOrSlug, userId) => {
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
    .select(
      "name slug description about website contactEmail industry location logo bannerUrl visibility joinPolicy owner createdAt updatedAt metadata",
    )
    .populate("owner", "name email")
    .lean();

  if (!organization) {
    throw new NotFoundError("Organization not found.");
  }

  // Authorization check: private orgs require membership or ownership
  if (organization.visibility !== "public") {
    const isOwner = organization.owner?._id
      ? organization.owner._id.toString() === userId.toString()
      : organization.owner?.toString() === userId.toString();

    const membership = await Membership.findOne({
      user: userId,
      organization: organization._id,
      status: "active",
    }).lean();

    if (!membership && !isOwner && !isLegacyMember(organization, userId)) {
      throw new ForbiddenError("Not authorized to view this organization.");
    }
  }

  const memberCount = await Membership.countDocuments({
    organization: organization._id,
    status: "active",
  });

  return {
    success: true,
    organization: {
      ...organization,
      memberCount:
        memberCount || (organization.members ? organization.members.length : 1),
    },
  };
};

/**
 * ✅ Update Organization Settings
 */
export const updateOrganization = async (
  userId,
  id,
  {
    name,
    description,
    about,
    website,
    contactEmail,
    industry,
    location,
    logo,
    logoUrl,
    bannerUrl,
    visibility,
    joinPolicy,
    metadata,
  },
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
  const isOwner = organization.owner.toString() === userId.toString();
  const membership = await Membership.findOne({
    user: userId,
    organization: cleanId,
    role: { $in: ["admin", "owner"] },
    status: "active",
  }).lean();

  if (!isOwner && !membership) {
    throw new ForbiddenError("Not authorized to update this organization.");
  }

  // Input validation & field updates
  if (name !== undefined) {
    const trimmedName = String(name).trim();
    if (!trimmedName) {
      throw new ValidationError("Organization name is required.");
    }
    if (trimmedName.length > 100) {
      throw new ValidationError(
        "Organization name cannot exceed 100 characters.",
      );
    }

    // Check duplicate name
    const escapedName = escapeRegex(trimmedName);
    const existingOrg = await Organization.findOne({
      _id: { $ne: cleanId },
      name: { $regex: `^${escapedName}$`, $options: "i" },
    });
    if (existingOrg) {
      throw new ConflictError("An organization with this name already exists.");
    }
    organization.name = trimmedName;
  }

  if (
    contactEmail !== undefined &&
    contactEmail !== null &&
    contactEmail !== ""
  ) {
    const trimmedEmail = String(contactEmail).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@.]+\.[^\s@.]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      throw new ValidationError("Invalid contact email format.");
    }
    organization.contactEmail = trimmedEmail;
  } else if (contactEmail === "") {
    organization.contactEmail = "";
  }

  if (website !== undefined && website !== null && website !== "") {
    const trimmedWebsite = String(website).trim();
    const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/.*)?$/i;
    if (!urlPattern.test(trimmedWebsite)) {
      throw new ValidationError("Invalid website URL format.");
    }
    organization.website = trimmedWebsite;
  } else if (website === "") {
    organization.website = "";
  }

  if (description !== undefined) {
    const trimmedDesc = String(description).trim();
    if (trimmedDesc.length > 500) {
      throw new ValidationError("Description cannot exceed 500 characters.");
    }
    organization.description = trimmedDesc;
  }

  if (about !== undefined) {
    const trimmedAbout = String(about).trim();
    if (trimmedAbout.length > 2000) {
      throw new ValidationError("About bio cannot exceed 2000 characters.");
    }
    organization.about = trimmedAbout;
  }

  if (industry !== undefined) {
    const trimmedInd = String(industry).trim();
    if (trimmedInd.length > 100) {
      throw new ValidationError("Industry cannot exceed 100 characters.");
    }
    organization.industry = trimmedInd;
  }

  if (location !== undefined) {
    const trimmedLoc = String(location).trim();
    if (trimmedLoc.length > 100) {
      throw new ValidationError("Location cannot exceed 100 characters.");
    }
    organization.location = trimmedLoc;
  }

  // Prefer logoUrl when provided (issue #510 naming); fall back to logo.
  const logoInput = logoUrl !== undefined ? logoUrl : logo;
  if (logoInput !== undefined) {
    const normalized = normalizeImageUrl(logoInput, "Logo URL");
    if (!normalized.ok) {
      throw new ValidationError(normalized.message);
    }
    if (normalized.value !== undefined) {
      organization.logo = normalized.value;
    }
  }

  if (bannerUrl !== undefined) {
    const normalized = normalizeImageUrl(bannerUrl, "Banner URL");
    if (!normalized.ok) {
      throw new ValidationError(normalized.message);
    }
    if (normalized.value !== undefined) {
      organization.bannerUrl = normalized.value;
    }
  }

  if (cleanVisibility) organization.visibility = cleanVisibility;
  if (cleanJoinPolicy) organization.joinPolicy = cleanJoinPolicy;
  if (metadata)
    organization.metadata = typeof metadata === "object" ? metadata : {};

  await organization.save();

  // Audit log
  AuditService.logAction({
    actorId: userId,
    action: "ORGANIZATION_UPDATED",
    entity: "Organization",
    entityId: organization._id,
    organizationId: organization._id,
    details: { name: organization.name },
  });

  const memberCount = await Membership.countDocuments({
    organization: organization._id,
    status: "active",
  });

  let resultOrg = organization;
  try {
    const query = Organization.findById(organization._id);
    if (query && typeof query.populate === "function") {
      const pOrg = await query
        .populate("owner", "name email profilePic")
        .lean();
      if (pOrg) resultOrg = pOrg;
    }
  } catch {
    resultOrg = organization;
  }

  return {
    success: true,
    message: "Organization settings updated successfully.",
    organization: {
      ...resultOrg,
      memberCount: memberCount || 1,
    },
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

/**
 * ✅ Get Organization Leaderboard
 */
export const getOrganizationLeaderboard = async (userId, id) => {
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

  // Get active memberships sorted by engagementScore descending
  const memberships = await Membership.find({
    organization: cleanId,
    status: "active",
  })
    .populate("user", "name email profilePic isAccountVerified")
    .sort({ engagementScore: -1 })
    .limit(10)
    .lean();

  const topContributors = memberships.map((m) => ({
    _id: m.user._id,
    name: m.user.name,
    email: m.user.email,
    profilePic: m.user.profilePic,
    engagementScore: m.engagementScore || 0,
    role: m.role,
  }));

  return {
    success: true,
    topContributors,
    organizationName: organization.name,
  };
};

/**
 * ✅ Award Gamification Points
 */
export const awardEngagementPoints = async (userId, organizationId, points) => {
  if (!isValidObjectId(userId) || !isValidObjectId(organizationId)) return;

  try {
    await Membership.findOneAndUpdate(
      { user: userId, organization: organizationId, status: "active" },
      { $inc: { engagementScore: points } },
    );
  } catch (error) {
    console.error("❌ Failed to award engagement points:", error);
  }
};

/**
 * ✅ Invite Member to Organization by Email
 */
export const inviteMemberToOrganization = async (
  actorId,
  orgId,
  { email, role = "member", message = "" },
) => {
  if (!isValidObjectId(actorId) || !isValidObjectId(orgId)) {
    throw new ValidationError("Invalid parameters provided.");
  }

  const organization = await Organization.findById(orgId);
  if (!organization) {
    throw new NotFoundError("Organization not found.");
  }

  // Permission check: actor must be owner or admin
  const actorMembership = await Membership.findOne({
    user: actorId,
    organization: orgId,
    status: "active",
  });

  const isOwner = organization.owner?.toString() === actorId.toString();
  const isAdmin =
    actorMembership?.role === "admin" || actorMembership?.role === "owner";
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError("Only owners and admins can invite members.");
  }

  const cleanEmail = email.trim().toLowerCase();
  const validRole = ["admin", "member", "viewer"].includes(role)
    ? role
    : "member";

  // Generate token and create invitation
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await Invitation.create({
    organization: orgId,
    email: cleanEmail,
    invitedBy: actorId,
    token,
    role: validRole,
    status: "pending",
    expiresAt,
    message,
  });

  // Check if target user exists
  const existingUser = await userModel.findOne({ email: cleanEmail });

  // Update embedded organization members list if user exists
  if (existingUser) {
    const existingMemberIdx = organization.members.findIndex(
      (m) => m.userId?.toString() === existingUser._id.toString(),
    );

    if (existingMemberIdx >= 0) {
      organization.members[existingMemberIdx].status = "invited";
      organization.members[existingMemberIdx].role = validRole;
    } else {
      organization.members.push({
        userId: existingUser._id,
        role: validRole,
        invitedBy: actorId,
        joinedAt: new Date(),
        status: "invited",
      });
    }
    await organization.save();
  }

  // Send invitation email via EmailService
  try {
    const inviter = await userModel.findById(actorId);
    await EmailService.sendInvitation({
      to: cleanEmail,
      organizationName: organization.name,
      invitedBy: inviter?.name || "An administrator",
      inviteLink: `${process.env.CLIENT_URL || "http://localhost:5173"}/invite/${token}`,
    });
  } catch (emailErr) {
    console.warn("⚠️ Failed to send invitation email:", emailErr.message);
  }

  // Log audit action
  await AuditService.logAction({
    actorId,
    action: "ORGANIZATION_MEMBER_INVITED",
    entity: "Organization",
    entityId: orgId,
    organizationId: orgId,
    details: {
      email: cleanEmail,
      role: validRole,
      invitationId: invitation._id,
    },
  });

  return {
    success: true,
    message: "Invitation sent successfully.",
    invitation,
  };
};

/**
 * ✅ Accept Organization Invitation Token
 */
export const acceptOrganizationInviteToken = async (token, userId) => {
  if (!token) throw new ValidationError("Invitation token required.");
  if (!isValidObjectId(userId)) throw new ValidationError("Invalid user ID.");

  const invitation = await Invitation.findOne({ token, status: "pending" });
  if (!invitation)
    throw new NotFoundError("Invalid or expired invitation token.");

  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    invitation.status = "expired";
    await invitation.save();
    throw new ValidationError("Invitation token has expired.");
  }

  const organization = await Organization.findById(invitation.organization);
  if (!organization) throw new NotFoundError("Organization not found.");

  // Upsert membership
  let membership = await Membership.findOne({
    user: userId,
    organization: organization._id,
  });
  if (membership) {
    membership.status = "active";
    membership.role = invitation.role || "member";
    await membership.save();
  } else {
    membership = await Membership.create({
      user: userId,
      organization: organization._id,
      role: invitation.role || "member",
      status: "active",
      joinedAt: new Date(),
    });
  }

  // Update embedded members in Organization
  const existingIdx = organization.members.findIndex(
    (m) => m.userId?.toString() === userId.toString(),
  );
  if (existingIdx >= 0) {
    organization.members[existingIdx].status = "active";
    organization.members[existingIdx].role = invitation.role || "member";
  } else {
    organization.members.push({
      userId,
      role: invitation.role || "member",
      invitedBy: invitation.invitedBy,
      joinedAt: new Date(),
      status: "active",
    });
  }
  await organization.save();

  // Mark invitation accepted
  invitation.status = "accepted";
  invitation.acceptedAt = new Date();
  invitation.acceptedBy = userId;
  await invitation.save();

  // Update user's active organization and role
  await userModel.findByIdAndUpdate(userId, {
    organization: organization._id,
    role: invitation.role || "member",
  });

  // Log audit action
  await AuditService.logAction({
    actorId: userId,
    action: "ORGANIZATION_INVITE_ACCEPTED",
    entity: "Organization",
    entityId: organization._id,
    organizationId: organization._id,
    details: { invitationId: invitation._id, role: invitation.role },
  });

  return {
    success: true,
    message: "Invitation accepted successfully.",
    organization: {
      _id: organization._id,
      name: organization.name,
      slug: organization.slug,
    },
  };
};

/**
 * ✅ Update Member Role in Organization
 */
export const updateMemberRole = async (
  actorId,
  orgId,
  targetUserId,
  newRole,
) => {
  if (
    !isValidObjectId(actorId) ||
    !isValidObjectId(orgId) ||
    !isValidObjectId(targetUserId)
  ) {
    throw new ValidationError("Invalid arguments provided.");
  }

  const validRoles = ["owner", "admin", "member", "viewer"];
  if (!validRoles.includes(newRole)) {
    throw new ValidationError("Invalid role specified.");
  }

  const organization = await Organization.findById(orgId);
  if (!organization) throw new NotFoundError("Organization not found.");

  // Permission check: actor must be owner or admin
  const actorMembership = await Membership.findOne({
    user: actorId,
    organization: orgId,
    status: "active",
  });
  const isOwner = organization.owner?.toString() === actorId.toString();
  const isAdmin =
    actorMembership?.role === "admin" || actorMembership?.role === "owner";
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError("Only owners and admins can update member roles.");
  }

  // Update Membership record
  const targetMembership = await Membership.findOne({
    user: targetUserId,
    organization: orgId,
  });
  const oldRole = targetMembership?.role || "member";
  if (targetMembership) {
    targetMembership.role = newRole;
    await targetMembership.save();
  }

  // Update embedded Organization.members array
  const memberIdx = organization.members.findIndex(
    (m) => m.userId?.toString() === targetUserId.toString(),
  );
  if (memberIdx >= 0) {
    organization.members[memberIdx].role = newRole;
  } else {
    organization.members.push({
      userId: targetUserId,
      role: newRole,
      joinedAt: new Date(),
      status: "active",
    });
  }

  if (newRole === "owner" && isOwner) {
    organization.owner = targetUserId;
  }
  await organization.save();

  // Also update user's active role in userModel if target user currently has this active org
  const targetUser = await userModel.findById(targetUserId);
  if (targetUser && targetUser.organization?.toString() === orgId.toString()) {
    targetUser.role = newRole;
    await targetUser.save();
  }

  // Log audit action
  await AuditService.logAction({
    actorId,
    action: "MEMBER_ROLE_CHANGED",
    entity: "User",
    entityId: targetUserId,
    organizationId: orgId,
    details: { oldRole, newRole, targetUserId },
  });

  return {
    success: true,
    message: `Member role updated to ${newRole}.`,
  };
};

/**
 * ✅ Remove Member from Organization
 */
export const removeMemberFromOrganization = async (
  actorId,
  orgId,
  targetUserId,
) => {
  if (
    !isValidObjectId(actorId) ||
    !isValidObjectId(orgId) ||
    !isValidObjectId(targetUserId)
  ) {
    throw new ValidationError("Invalid arguments provided.");
  }

  const organization = await Organization.findById(orgId);
  if (!organization) throw new NotFoundError("Organization not found.");

  if (organization.owner?.toString() === targetUserId.toString()) {
    throw new ForbiddenError("Cannot remove the organization owner.");
  }

  const actorMembership = await Membership.findOne({
    user: actorId,
    organization: orgId,
    status: "active",
  });
  const isOwner = organization.owner?.toString() === actorId.toString();
  const isAdmin =
    actorMembership?.role === "admin" || actorMembership?.role === "owner";
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError("Only owners and admins can remove members.");
  }

  // Delete/deactivate Membership record
  await Membership.findOneAndUpdate(
    { user: targetUserId, organization: orgId },
    { status: "removed" },
  );

  // Remove from embedded Organization.members array
  organization.members = organization.members.filter(
    (m) => m.userId?.toString() !== targetUserId.toString(),
  );
  await organization.save();

  // Reset target user's active organization if it matched
  const targetUser = await userModel.findById(targetUserId);
  if (targetUser && targetUser.organization?.toString() === orgId.toString()) {
    targetUser.organization = null;
    targetUser.role = "member";
    await targetUser.save();
  }

  // Log audit action
  await AuditService.logAction({
    actorId,
    action: "MEMBER_REMOVED",
    entity: "User",
    entityId: targetUserId,
    organizationId: orgId,
    details: { targetUserId },
  });

  return {
    success: true,
    message: "Member removed from organization successfully.",
  };
};

/**
 * ✅ Get Paginated Audit Logs for Organization
 */
export const getOrganizationAuditLogsService = async (
  actorId,
  orgId,
  { page = 1, limit = 20, startDate, endDate, action, actor } = {},
) => {
  if (!isValidObjectId(actorId) || !isValidObjectId(orgId)) {
    throw new ValidationError("Invalid arguments provided.");
  }

  const organization = await Organization.findById(orgId);
  if (!organization) throw new NotFoundError("Organization not found.");

  const actorMembership = await Membership.findOne({
    user: actorId,
    organization: orgId,
    status: "active",
  });
  const isOwner = organization.owner?.toString() === actorId.toString();
  const isAdmin =
    actorMembership?.role === "admin" || actorMembership?.role === "owner";
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError("Only owners and admins can view audit logs.");
  }

  const filter = { organization: orgId };
  if (action) filter.action = action;
  if (actor && isValidObjectId(actor)) filter.actor = actor;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const logs = await AuditLog.find(filter)
    .populate("actor", "name email profilePic")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  const total = await AuditLog.countDocuments(filter);

  return {
    success: true,
    logs,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1,
    },
  };
};
