import React, { useContext } from "react";
import AppContent from "../context/AppContent";
import { ROLE_HIERARCHY, hasPermission } from "../utils/rbacPermissions.js";

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

  // Check resource permission (shared map — mirrors backend)
  if (resource && action) {
    if (!hasPermission(userRole, resource, action)) {
      return fallback;
    }
  }

  return <>{children}</>;
};

export default RoleGate;
