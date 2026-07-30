// server/utils/rbacPermissions.js
// Centralized RBAC Permission System

// Role hierarchy (higher number = more permissions)
export const ROLE_HIERARCHY = {
  owner: 5,
  admin: 4,
  moderator: 3,
  member: 2,
  viewer: 1,
  guest: 0,
};

// Resource permissions
export const PERMISSIONS = {
  // Meeting permissions
  meetings: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    create: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin", "moderator", "member"],
    delete: ["owner", "admin"],
    export: ["owner", "admin", "moderator", "member"],
    transcribe: ["owner", "admin", "moderator", "member"],
  },
  // Policy permissions
  policies: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    create: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin", "moderator", "member"],
    delete: ["owner", "admin"],
    approve: ["owner", "admin"],
  },
  // Task permissions
  tasks: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    create: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin", "moderator", "member"],
    delete: ["owner", "admin", "moderator"],
    assign: ["owner", "admin", "moderator"],
  },
  // Calendar permissions
  calendar: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    create: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin", "moderator", "member"],
    delete: ["owner", "admin", "moderator"],
  },
  // AI Search permissions
  ai_search: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    search: ["owner", "admin", "moderator", "member", "viewer"],
  },
  // Team Members permissions
  team_members: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    invite: ["owner", "admin"],
    remove: ["owner", "admin"],
    change_role: ["owner", "admin"],
  },
  // Organization permissions
  organizations: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    create: ["owner", "admin"],
    edit: ["owner", "admin"],
    delete: ["owner"],
    leave: ["owner", "admin", "moderator", "member", "viewer", "guest"],
  },
  // Settings permissions
  settings: {
    view: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin"],
    self_view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    self_edit: ["owner", "admin", "moderator", "member", "viewer", "guest"],
  },
  // Reports permissions
  reports: {
    view: ["owner", "admin", "moderator", "member"],
    export: ["owner", "admin", "moderator"],
  },
  // Admin Panel permissions
  admin_panel: {
    view: ["owner", "admin"],
    manage: ["owner", "admin"],
  },
  // Knowledge Base permissions
  knowledge: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    create: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin", "moderator", "member"],
    delete: ["owner", "admin", "moderator"],
    consolidate: ["owner", "admin", "moderator"],
    resolve_conflicts: ["owner", "admin", "moderator"],
    manage_lifecycle: ["owner", "admin", "moderator"],
  },
  // Notifications permissions
  notifications: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    manage: ["owner", "admin"],
    self_manage: ["owner", "admin", "moderator", "member", "viewer", "guest"],
  },
  // Audit Logs permissions
  audit_logs: {
    view: ["owner", "admin"],
  },
};

/**
 * Check if a role has permission for a specific action on a resource
 */
export const hasPermission = (role, resource, action) => {
  if (!role || !resource || !action) {
    return false;
  }

  const resourcePermissions = PERMISSIONS[resource];
  if (!resourcePermissions) {
    console.warn(`Unknown resource: ${resource}`);
    return false;
  }

  const actionPermissions = resourcePermissions[action];
  if (!actionPermissions) {
    console.warn(`Unknown action: ${action} for resource: ${resource}`);
    return false;
  }

  return actionPermissions.includes(role);
};

export const hasAnyPermission = (role, resource, actions) => {
  return actions.some((action) => hasPermission(role, resource, action));
};

export const hasAllPermissions = (role, resource, actions) => {
  return actions.every((action) => hasPermission(role, resource, action));
};

export const hasHigherOrEqualRole = (role1, role2) => {
  return (ROLE_HIERARCHY[role1] || 0) >= (ROLE_HIERARCHY[role2] || 0);
};

export const getRolePermissions = (role) => {
  const permissions = {};

  Object.keys(PERMISSIONS).forEach((resource) => {
    permissions[resource] = {};
    Object.keys(PERMISSIONS[resource]).forEach((action) => {
      permissions[resource][action] = hasPermission(role, resource, action);
    });
  });

  return permissions;
};

export const isValidRole = (role) => {
  return Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, role);
};
