// server/controllers/organizationController.js
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";
import Membership from "../models/membershipModel.js";
import Invitation from "../models/invitationModel.js";
import MembershipRequest from "../models/membershipRequestModel.js";
import { createAndPushNotification } from "../services/notificationService.js";
import mongoose from "mongoose";
import crypto from "crypto";
import AuditService from "../services/AuditService.js";
/**
 * Escape special regex characters to prevent ReDoS attacks
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

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
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    // Validate org name
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide an organization name.",
      });
    }

    const userId = req.user.id;
    const orgName = name.trim();

    // Check if organization already exists (case-insensitive match)
    let organization = await Organization.findOne({
      name: { $regex: `^${orgName}$`, $options: "i" },
    });

    let message = "";

    if (organization) {
      // --- Join existing organization ---
      const alreadyMember = organization.members.some(
        (m) => m.toString() === userId.toString(),
      );

      if (alreadyMember) {
        return res.status(400).json({
          success: false,
          message: "You are already a member of this organization.",
        });
      }

      // Validate visibility & permission to join
      const orgVisibility = organization.visibility || "private";
      if (orgVisibility !== "public") {
        const user = await userModel.findById(userId);
        const token = req.body.invitationToken || req.body.token;

        let invitation = null;
        if (token) {
          invitation = await Invitation.findOne({
            token,
            organization: organization._id,
            status: "pending",
            expiresAt: { $gt: new Date() },
          });
        } else if (user?.email) {
          invitation = await Invitation.findOne({
            organization: organization._id,
            email: user.email.toLowerCase(),
            status: "pending",
            expiresAt: { $gt: new Date() },
          });
        }

        if (!invitation) {
          const pendingRequest = await MembershipRequest.findOne({
            user: userId,
            organization: organization._id,
            status: "pending",
          });
          if (pendingRequest) {
            return res.status(409).json({
              success: false,
              message: "Membership request is already pending approval.",
            });
          }
          return res.status(403).json({
            success: false,
            message:
              "Forbidden: Private or invite-only organization cannot be joined without a valid invitation.",
          });
        }

        invitation.status = "accepted";
        invitation.acceptedAt = new Date();
        invitation.acceptedBy = userId;
        await invitation.save();
      }

      organization.members.push(userId);
      await organization.save();

      await Membership.findOneAndUpdate(
        { user: userId, organization: organization._id },
        {
          user: userId,
          organization: organization._id,
          role: "member",
          status: "active",
        },
        { upsert: true, new: true },
      );

      await userModel.findByIdAndUpdate(userId, {
        role: "member",
        organization: organization._id,
        hasCompletedOnboarding: true,
      });

      message = "Joined existing organization successfully.";

      // Notify the organization admin
      const io = req.app.get("io");
      if (
        io &&
        organization.createdBy &&
        organization.createdBy.toString() !== userId.toString()
      ) {
        try {
          await createAndPushNotification(
            io,
            organization.createdBy,
            "New Member Joined",
            `A new user has joined your organization: ${organization.name}.`,
            "organizations",
            "/team-members",
            "View Team",
          );
        } catch (notifErr) {
          console.error("⚠️ Notification error:", notifErr.message);
        }
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

      await Membership.create({
        user: userId,
        organization: organization._id,
        role: "admin",
        status: "active",
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

    res.status(200).json({
      success: true,
      message,
      userData: {
        ...updatedUser._doc,
        role: roleStr,
        organization: orgDoc,
      },
    });
  } catch (error) {
    console.error("❌ Error creating/joining organization:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get All Organizations (For listing)
 * Returns: { success: true, organizations: [...] }
 */
export const getAllOrganizations = async (req, res) => {
  try {
    const organizations = await Organization.find({}, "name _id").sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, organizations });
  } catch (error) {
    console.error("❌ Error fetching organizations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Join organization by ID (member flow)
 * Body: { organizationId: "<org id>" }
 */
export const joinOrganization = async (req, res) => {
  try {
    const { organizationId } = req.body;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!organizationId) {
      return res
        .status(400)
        .json({ success: false, message: "organizationId is required." });
    }

    // Validate organizationId is a valid MongoDB ObjectId to prevent NoSQL injection
    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid organization ID format." });
    }

    const userId = req.user.id;

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    const alreadyMember = organization.members.some(
      (m) => m.toString() === userId.toString(),
    );

    if (alreadyMember) {
      return res.status(400).json({
        success: false,
        message: "You are already a member of this organization.",
      });
    }

    // Validate visibility & permission to join
    const orgVisibility = organization.visibility || "private";
    if (orgVisibility !== "public") {
      const user = await userModel.findById(userId);
      const token = req.body.invitationToken || req.body.token;

      let invitation = null;
      if (token) {
        invitation = await Invitation.findOne({
          token,
          organization: organization._id,
          status: "pending",
          expiresAt: { $gt: new Date() },
        });
      } else if (user?.email) {
        invitation = await Invitation.findOne({
          organization: organization._id,
          email: user.email.toLowerCase(),
          status: "pending",
          expiresAt: { $gt: new Date() },
        });
      }

      if (!invitation) {
        const pendingRequest = await MembershipRequest.findOne({
          user: userId,
          organization: organization._id,
          status: "pending",
        });
        if (pendingRequest) {
          return res.status(409).json({
            success: false,
            message: "Membership request is already pending approval.",
          });
        }
        return res.status(403).json({
          success: false,
          message:
            "Forbidden: Private or invite-only organization cannot be joined without a valid invitation.",
        });
      }

      invitation.status = "accepted";
      invitation.acceptedAt = new Date();
      invitation.acceptedBy = userId;
      await invitation.save();
    }

    organization.members.push(userId);
    await organization.save();

    await Membership.findOneAndUpdate(
      { user: userId, organization: organization._id },
      {
        user: userId,
        organization: organization._id,
        role: "member",
        status: "active",
      },
      { upsert: true, new: true },
    );

    // Update user to be a member of this organization
    await userModel.findByIdAndUpdate(userId, {
      role: "member",
      organization: organization._id,
      hasCompletedOnboarding: true,
    });

    const updatedUser = await userModel
      .findById(userId)
      .populate("organization", "name logo");

    // Notify the organization admin
    const io = req.app.get("io");
    if (
      io &&
      organization.createdBy &&
      organization.createdBy.toString() !== userId.toString()
    ) {
      try {
        await createAndPushNotification(
          io,
          organization.createdBy,
          "New Member Joined",
          `A new user has joined your organization: ${organization.name}.`,
          "organizations",
          "/team-members",
          "View Team",
        );
      } catch (notifErr) {
        console.error("⚠️ Notification error:", notifErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: "Joined organization successfully.",
      userData: updatedUser,
    });
  } catch (error) {
    console.error("❌ Error joining organization by ID:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Select organization (for users with multiple orgs)
 * Body: { organizationId: "<org id>" }
 */
export const selectOrganization = async (req, res) => {
  try {
    const { organizationId } = req.body;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!organizationId) {
      return res
        .status(400)
        .json({ success: false, message: "organizationId is required." });
    }

    // Validate organizationId is a valid MongoDB ObjectId to prevent NoSQL injection
    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid organization ID format." });
    }

    const userId = req.user.id;

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    const isMember = organization.members.some(
      (m) => m.toString() === userId.toString(),
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this organization.",
      });
    }

    // Get user's membership role in the selected organization
    const Membership = (await import("../models/membershipModel.js")).default;
    const membership = await Membership.findOne({
      user: userId,
      organization: organization._id,
      status: "active",
    });

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

    res.status(200).json({
      success: true,
      message: "Organization selected successfully.",
      userData: updatedUser,
    });
  } catch (error) {
    console.error("❌ Error selecting organization:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get organization members
 * Returns: { success: true, members: [...] }
 */
export const getOrganizationMembers = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const user = await userModel.findById(req.user.id);
    if (!user || !user.organization) {
      return res.status(400).json({
        success: false,
        message: "User is not part of an organization.",
      });
    }

    const organization = await Organization.findById(
      user.organization,
    ).populate({
      path: "members",
      select: "name email role createdAt isAccountVerified",
    });

    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    res.status(200).json({
      success: true,
      members: organization.members,
      organizationName: organization.name,
    });
  } catch (error) {
    console.error("❌ Error fetching organization members:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get public organization profile by slug
 * Returns only public information, no private data
 * Route: GET /api/organizations/public/:slug
 */
export const getPublicOrganizationBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res
        .status(400)
        .json({ success: false, message: "Slug is required." });
    }

    // Find organization by slug - only select public fields
    const organization = await Organization.findOne(
      { slug },
      "name slug description logo visibility createdAt metadata",
    );

    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    // Get member count from Membership model (without exposing member details)
    const Membership = (await import("../models/membershipModel.js")).default;
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

    return res.status(200).json({
      success: true,
      organization: publicData,
    });
  } catch (error) {
    console.error("❌ Error fetching public organization:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
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

    return res.status(200).json({
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
    });
  } catch (error) {
    console.error("❌ Error browsing public organizations:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
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

    res.status(200).json({
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
    });
  } catch (error) {
    console.error("❌ Error searching organizations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get user's joined organizations
 * GET /api/organizations/user
 */
export const getUserOrganizations = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    const Membership = (await import("../models/membershipModel.js")).default;
    const memberships = await Membership.find({
      user: req.user.id,
      status: "active",
    })
      .populate("organization", "name slug description logo visibility members updatedAt")
      .lean();

    const organizations = memberships
      .filter((m) => m.organization)
      .map((m) => ({
        ...m.organization,
        role: m.role,
        memberCount: m.organization.members ? m.organization.members.length : 0,
        lastActive: m.organization.updatedAt || new Date(),
      }));

    res.status(200).json({ success: true, organizations });
  } catch (error) {
    console.error("❌ Error fetching user organizations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
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
const allowedVisibilities = ["public", "private"];
const isValidVisibility = (visibility) =>
  allowedVisibilities.includes(visibility);

/**
 * Whitelist allowed role values
 */
const allowedRoles = ["admin", "member"];
const isValidRole = (role) => allowedRoles.includes(role);

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

/**
 * ✅ Create Organization (New version)
 * POST /api/organizations
 */
export const createOrganization = async (req, res) => {
  try {
    const { name, description, logo, visibility, metadata } = req.body;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Organization name is required." });
    }

    const userId = req.user.id;
    const orgName = name.trim();

    // Check if organization with same name exists (case-insensitive)
    const existingOrg = await Organization.findOne({
      name: { $regex: `^${orgName}$`, $options: "i" },
    });

    if (existingOrg) {
      return res
        .status(409)
        .json({
          success: false,
          message: "Organization with this name already exists.",
        });
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
      owner: userId,
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

    res.status(201).json({
      success: true,
      message: "Organization created successfully.",
      organization,
    });
  } catch (error) {
    console.error("❌ Error creating organization:", error);
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Organization slug already exists." });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get All Organizations (Paginated)
 * GET /api/organizations
 */
export const getOrganizations = async (req, res) => {
  try {
    const { visibility, page = 1, limit = 20 } = req.query;

    const filter = {};
    const validVisibility =
      visibility && isValidVisibility(visibility)
        ? allowedVisibilities.find((v) => v === visibility)
        : null;
    if (visibility) {
      // Validate visibility value
      if (!validVisibility) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid visibility value." });
      }
      filter.visibility = validVisibility;
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

    res.status(200).json({
      success: true,
      organizations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching organizations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get Organization by ID or Slug
 * GET /api/organizations/:idOrSlug
 */
export const getOrganizationById = async (req, res) => {
  try {
    const { idOrSlug } = req.params;

    // Validate input - only allow alphanumeric, hyphens, and underscores for slug
    const slugRegex = /^[a-zA-Z0-9-_]+$/;
    if (!slugRegex.test(idOrSlug)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid organization identifier." });
    }

    // Try as ObjectId first, then as slug
    const isObjectId = isValidObjectId(idOrSlug);
    const query = isObjectId
      ? { _id: new mongoose.Types.ObjectId(String(idOrSlug)) }
      : { slug: String(idOrSlug) };

    const organization = await Organization.findOne(query)
      .populate("owner", "name email")
      .lean();

    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    res.status(200).json({ success: true, organization });
  } catch (error) {
    console.error("❌ Error fetching organization:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Update Organization
 * PUT /api/organizations/:id
 */
export const updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, logo, visibility, metadata } = req.body;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    // Validate organizationId
    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid organization ID." });
    }

    const cleanId = new mongoose.Types.ObjectId(String(id));

    // Validate visibility if provided
    if (visibility && !isValidVisibility(visibility)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid visibility value." });
    }

    const cleanVisibility =
      visibility && isValidVisibility(visibility)
        ? allowedVisibilities.find((v) => v === visibility)
        : undefined;

    const organization = await Organization.findById(cleanId);

    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    // Check if user is owner or admin
    const membership = await Membership.findOne({
      user: req.user.id,
      organization: cleanId,
      role: "admin",
      status: "active",
    }).lean();

    if (
      !membership &&
      organization.owner.toString() !== req.user.id.toString()
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Not authorized to update this organization.",
        });
    }

    // Update fields with sanitization
    if (name) organization.name = String(name).trim().substring(0, 100);
    if (description !== undefined)
      organization.description = String(description).trim().substring(0, 500);
    if (logo !== undefined)
      organization.logo = String(logo).trim().substring(0, 500);
    if (cleanVisibility) organization.visibility = cleanVisibility;
    if (metadata)
      organization.metadata = typeof metadata === "object" ? metadata : {};

    await organization.save();

    res.status(200).json({
      success: true,
      message: "Organization updated successfully.",
      organization,
    });
  } catch (error) {
    console.error("❌ Error updating organization:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Delete Organization
 * DELETE /api/organizations/:id
 */
export const deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    // Validate organizationId
    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid organization ID." });
    }

    const cleanId = new mongoose.Types.ObjectId(String(id));

    const organization = await Organization.findById(cleanId);

    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    // Only owner can delete
    if (organization.owner.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Not authorized to delete this organization.",
        });
    }

    // Delete all memberships
    await Membership.deleteMany({ organization: cleanId });

    // Delete organization
    await Organization.findByIdAndDelete(cleanId);

    res.status(200).json({
      success: true,
      message: "Organization deleted successfully.",
    });
  } catch (error) {
    console.error("❌ Error deleting organization:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get Organization Members by ID
 * GET /api/organizations/:id/members
 */
export const getOrganizationMembersById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    // Validate organizationId
    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid organization ID." });
    }

    const cleanId = new mongoose.Types.ObjectId(String(id));

    const organization = await Organization.findById(cleanId);

    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    // Check if user is a member
    const membership = await Membership.findOne({
      user: req.user.id,
      organization: cleanId,
      status: "active",
    }).lean();

    if (!membership) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Not a member of this organization.",
        });
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

    res.status(200).json({
      success: true,
      members,
      organizationName: organization.name,
    });
  } catch (error) {
    console.error("❌ Error fetching organization members:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
