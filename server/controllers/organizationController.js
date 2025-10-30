// backend/controllers/organizationController.js
import Organization from "../models/organizationModel.js";
import userModel from "../models/userModel.js";

// ✅ Create or Join an Organization (Unified)
export const createOrJoinOrganization = async (req, res) => {
  try {
    const { name } = req.body;

    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed." });
    }

    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide an organization name." });
    }

    const userId = req.user.id;
    const orgName = name.trim();

    // ✅ Check if organization exists
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

    // ✅ Fetch updated user data
    const updatedUser = await userModel
      .findById(userId)
      .populate("organization", "name");

    res.status(200).json({
      success: true,
      message,
      userData: updatedUser,
    });
  } catch (error) {
    console.error("Error creating/joining organization:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Get all organizations (Optional)
export const getAllOrganizations = async (req, res) => {
  try {
    const organizations = await Organization.find({}, "name _id");
    res.status(200).json({ success: true, data: organizations });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
