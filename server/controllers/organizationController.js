// server/controllers/organizationController.js
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";

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
      return res
        .status(400)
        .json({ success: false, message: "Please provide an organization name." });
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
        (m) => m.toString() === userId.toString()
      );

      if (!alreadyMember) {
        organization.members.push(userId);
        await organization.save();
      }

      await userModel.findByIdAndUpdate(userId, {
        role: "member",
        organization: organization._id,
        hasCompletedOnboarding: true,
      });

      message = "Joined existing organization successfully.";
    } else {
      // --- Create new organization ---
      organization = await Organization.create({
        name: orgName,
        createdBy: userId,
        members: [userId],
      });

      await userModel.findByIdAndUpdate(userId, {
        role: "admin",
        organization: organization._id,
        hasCompletedOnboarding: true,
      });

      message = "Organization created successfully!";
    }

    // Fetch updated user data (with organization populated)
    const updatedUser = await userModel
      .findById(userId)
      .populate("organization", "name");

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

    const userId = req.user.id;

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res
        .status(404)
        .json({ success: false, message: "Organization not found." });
    }

    const alreadyMember = organization.members.some(
      (m) => m.toString() === userId.toString()
    );

    if (!alreadyMember) {
      organization.members.push(userId);
      await organization.save();
    }

    // Update user to be a member of this organization
    await userModel.findByIdAndUpdate(userId, {
      role: "member",
      organization: organization._id,
      hasCompletedOnboarding: true,
    });

    const updatedUser = await userModel
      .findById(userId)
      .populate("organization", "name");

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
