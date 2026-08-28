import CustomRole from "../models/customRoleModel.js";
import rbacMatrixService from "../services/rbacMatrixService.js";

/**
 * Controller handling Custom Roles and Resource-Level ACL configurations
 */
export const createCustomRole = async (req, res) => {
  try {
    const organizationId =
      req.user?.organizationId || req.headers["x-organization-id"];
    const { name, description, permissions, priority } = req.body;

    if (!organizationId) {
      return res
        .status(400)
        .json({ error: "Organization context is required" });
    }
    if (!name) {
      return res.status(400).json({ error: "Role name is required" });
    }

    const role = await CustomRole.create({
      organizationId,
      name,
      description,
      permissions,
      priority: priority || 10,
    });

    return res.status(201).json({
      message: "Custom role created successfully",
      role,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ error: "Role name already exists in organization" });
    }
    return res.status(500).json({ error: error.message });
  }
};

export const getCustomRoles = async (req, res) => {
  try {
    const organizationId =
      req.user?.organizationId || req.headers["x-organization-id"];

    if (!organizationId) {
      return res
        .status(400)
        .json({ error: "Organization context is required" });
    }

    const roles = await CustomRole.find({ organizationId })
      .sort({ priority: 1 })
      .lean();
    return res.status(200).json({ roles });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const setResourceAclEntry = async (req, res) => {
  try {
    const organizationId =
      req.user?.organizationId || req.headers["x-organization-id"];
    const userId = req.user?._id || req.user?.id;
    const { resourceType, resourceId, granteeType, granteeId, permissions } =
      req.body;

    if (
      !resourceType ||
      !resourceId ||
      !granteeType ||
      !granteeId ||
      !permissions
    ) {
      return res.status(400).json({
        error:
          "resourceType, resourceId, granteeType, granteeId, and permissions are required",
      });
    }

    const acl = await rbacMatrixService.setResourceAcl({
      organizationId,
      resourceType,
      resourceId,
      granteeType,
      granteeId,
      permissions,
      grantedBy: userId,
    });

    return res.status(200).json({
      message: "Resource ACL updated successfully",
      acl,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const checkResourcePermission = async (req, res) => {
  try {
    const organizationId =
      req.user?.organizationId || req.headers["x-organization-id"];
    const userId = req.user?._id || req.user?.id;
    const userRoleId = req.user?.customRoleId || req.user?.roleId;
    const { resourceType, resourceId, requiredPermission } = req.query;

    const hasAccess = await rbacMatrixService.evaluateResourceAccess({
      organizationId,
      userId,
      userRoleId,
      resourceType,
      resourceId,
      requiredPermission: requiredPermission || "READ",
    });

    return res.status(200).json({ hasAccess });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
