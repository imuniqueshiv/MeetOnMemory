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

    // ✅ Validate authentication
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    // ✅ Validate org name
    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide an organization name." });
    }

    const userId = req.user.id;
    const orgName = name.trim();

    // ✅ Check if organization already exists
    let organization = await Organization.findOne({ name: orgName });
    let message = "";

    if (organization) {
      // --- Join existing organization ---
      const alreadyMember = organization.members.includes(userId);

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

    // ✅ Fetch updated user data (with organization populated)
    const updatedUser = await userModel
      .findById(userId)
      .populate("organization", "name");

    // ✅ Capitalize role & org name before sending response
    const formattedUser = {
      ...updatedUser._doc,
      role:
        updatedUser.role.charAt(0).toUpperCase() + updatedUser.role.slice(1),
      organization: {
        ...updatedUser.organization._doc,
        name: updatedUser.organization.name.toUpperCase(),
      },
    };

    res.status(200).json({
      success: true,
      message,
      userData: formattedUser,
    });
  } catch (error) {
    console.error("❌ Error creating/joining organization:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * ✅ Get All Organizations (Optional — For listing)
 */
export const getAllOrganizations = async (req, res) => {
  try {
    const organizations = await Organization.find({}, "name _id").sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, data: organizations });
  } catch (error) {
    console.error("❌ Error fetching organizations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
