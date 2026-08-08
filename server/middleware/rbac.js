// server/middleware/rbac.js
import mongoose from "mongoose";
import {
  hasPermission,
  hasHigherOrEqualRole,
  isValidRole,
} from "../utils/rbacPermissions.js";

/**
 * "May this user see this meeting-scoped document?" — the rule
 * `requireOrgAccess` has always applied, extracted so it can be reused
 * (Issue #1158).
 *
 * The note-version routes need the same rule but cannot use the middleware:
 * their path carries a `NoteVersion` id, so the meeting has to be resolved
 * first. Exporting the predicate keeps that from becoming a second, subtly
 * different definition of who may read a meeting.
 *
 * @param {{organization?: any, uploadedBy?: any}} doc
 * @param {{_id?: any, organization?: any}} user
 * @returns {boolean}
 */
export const canAccessMeetingDoc = (doc, user) => {
  if (!doc || !user) return false;

  const isOwner =
    Boolean(doc.uploadedBy) &&
    Boolean(user._id) &&
    doc.uploadedBy.toString() === user._id.toString();

  const isInSameOrg = Boolean(
    doc.organization &&
    user.organization &&
    doc.organization.toString() === user.organization.toString(),
  );

  return isOwner || isInSameOrg;
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!req.user.role) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: No role assigned",
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden: Insufficient role" });
    }

    next();
  };
};

export const requireAdminOrOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (req.user.role !== "admin" && req.user.role !== "owner") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Admin or Owner access required",
    });
  }

  next();
};

export const requireOrgMembership = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (!req.user.organization) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Organization membership required",
    });
  }

  next();
};

export const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!req.user.role) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: No role assigned",
      });
    }

    const userRole = req.user.role;

    if (!hasPermission(userRole, resource, action)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You don't have permission to ${action} ${resource}`,
      });
    }

    next();
  };
};

export const requireAnyPermission = (resource, actions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!req.user.role) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: No role assigned",
      });
    }

    const userRole = req.user.role;

    const hasAny = actions.some((action) =>
      hasPermission(userRole, resource, action),
    );

    if (!hasAny) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You don't have permission to perform any of these actions on ${resource}`,
      });
    }

    next();
  };
};

export const requireOwnerOrAdmin = (Model) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      if (!req.user.role) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: No role assigned",
        });
      }

      // Prefer :id (meetings/policies); fall back to :meetingId (transcript routes).
      const docId = req.params.id || req.params.meetingId;
      if (!docId) {
        return res
          .status(400)
          .json({ success: false, message: "Document ID required" });
      }
      if (!mongoose.Types.ObjectId.isValid(docId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Document ID format" });
      }

      const doc = await Model.findById(docId);
      if (!doc) {
        return res
          .status(404)
          .json({ success: false, message: "Resource not found" });
      }

      const isOwner = doc.uploadedBy?.toString() === req.user._id.toString();
      const isAdminInSameOrg =
        (req.user.role === "admin" || req.user.role === "owner") &&
        doc.organization &&
        req.user.organization &&
        doc.organization.toString() === req.user.organization.toString();

      if (!isOwner && !isAdminInSameOrg) {
        return res.status(403).json({
          success: false,
          message:
            "Forbidden: You don't have permission to access or modify this resource",
        });
      }

      req.doc = doc;
      next();
    } catch (error) {
      console.error("requireOwnerOrAdmin error:", error);
      res.status(500).json({
        success: false,
        message: "Server error during authorization check",
      });
    }
  };
};

export const requireOwner = (Model) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      // Prefer :id (meetings/policies); fall back to :meetingId (transcript routes).
      const docId = req.params.id || req.params.meetingId;
      if (!docId) {
        return res
          .status(400)
          .json({ success: false, message: "Document ID required" });
      }
      if (!mongoose.Types.ObjectId.isValid(docId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Document ID format" });
      }

      const doc = await Model.findById(docId);
      if (!doc) {
        return res
          .status(404)
          .json({ success: false, message: "Resource not found" });
      }

      const isOwner = doc.uploadedBy?.toString() === req.user._id.toString();

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Only the owner can modify this resource",
        });
      }

      req.doc = doc;
      next();
    } catch (error) {
      console.error("requireOwner error:", error);
      res.status(500).json({
        success: false,
        message: "Server error during authorization check",
      });
    }
  };
};

export const requireOrgAccess = (Model) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      if (!req.user.organization) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Organization membership required",
        });
      }

      // Prefer :id (meetings/policies); fall back to :meetingId (transcript routes).
      const docId = req.params.id || req.params.meetingId;
      if (!docId) {
        return res
          .status(400)
          .json({ success: false, message: "Document ID required" });
      }
      if (!mongoose.Types.ObjectId.isValid(docId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Document ID format" });
      }

      const doc = await Model.findById(docId);
      if (!doc) {
        return res
          .status(404)
          .json({ success: false, message: "Resource not found" });
      }

      if (!canAccessMeetingDoc(doc, req.user)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You don't have access to this resource",
        });
      }

      req.doc = doc;
      next();
    } catch (error) {
      console.error("requireOrgAccess error:", error);
      res.status(500).json({
        success: false,
        message: "Server error during authorization check",
      });
    }
  };
};

export const requireMinimumRole = (minimumRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!req.user.role) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: No role assigned",
      });
    }

    if (!isValidRole(minimumRole)) {
      return res.status(500).json({
        success: false,
        message: "Server error: Invalid role configuration",
      });
    }

    if (!hasHigherOrEqualRole(req.user.role, minimumRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Requires ${minimumRole} role or higher`,
      });
    }

    next();
  };
};
