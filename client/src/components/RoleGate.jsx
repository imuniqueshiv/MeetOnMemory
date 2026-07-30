import React, { useContext } from "react";
import AppContent from "../context/AppContent";

/**
 * Role & Permission Hierarchy for frontend gates
 */
const ROLE_HIERARCHY = {
  owner: 5,
  admin: 4,
  moderator: 3,
  member: 2,
  viewer: 1,
  guest: 0,
};

const PERMISSIONS = {
  meetings: {
    view: ["owner", "admin", "moderator", "member", "viewer"],
    create: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin", "moderator", "member"],
    delete: ["owner", "admin"],
  },
  policies: {
    view: ["owner", "admin", "moderator", "member", "viewer"],
    create: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin", "moderator", "member"],
    delete: ["owner", "admin"],
    approve: ["owner", "admin"],
  },
  team_members: {
    view: ["owner", "admin", "moderator", "member", "viewer"],
    invite: ["owner", "admin"],
    remove: ["owner", "admin"],
    change_role: ["owner", "admin"],
  },
  audit_logs: {
    view: ["owner", "admin"],
  },
  admin_panel: {
    view: ["owner", "admin"],
    manage: ["owner", "admin"],
  },
};

/**
 * RoleGate Component
 * Wraps children and only renders them if the current user satisfies
 * required role or permission criteria.
 */
const RoleGate = ({
  resource,
  action,
  role: requiredRoles,
  minRole,
  fallback = null,
  children,
}) => {
  const { userData } = useContext(AppContent);
  const userRole = userData?.role || "member";

  // Check required roles array/string
  if (requiredRoles) {
    const allowed = Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles];
    if (!allowed.includes(userRole)) {
      return fallback;
    }
  }

  // Check minimum role hierarchy
  if (minRole) {
    const userRank = ROLE_HIERARCHY[userRole] || 0;
    const requiredRank = ROLE_HIERARCHY[minRole] || 0;
    if (userRank < requiredRank) {
      return fallback;
    }
  }

  // Check resource permission
  if (resource && action) {
    const allowedForAction = PERMISSIONS[resource]?.[action] || [
      "owner",
      "admin",
    ];
    if (!allowedForAction.includes(userRole)) {
      return fallback;
    }
  }

  return <>{children}</>;
};

export default RoleGate;
