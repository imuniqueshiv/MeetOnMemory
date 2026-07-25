// server/utils/rbacPermissions.js
// Centralized RBAC Permission System

// Role hierarchy (higher number = more permissions)
export const ROLE_HIERARCHY = {
  owner: 5,
  admin: 4,
  moderator: 3,
  member: 2,
  guest: 1,
};

// Resource permissions
export const PERMISSIONS = {
  // Meeting permissions
  meetings: {
    view: ["owner", "admin", "moderator", "member", "guest"],
    create: ["owner", "admin", "moderator"],
    edit: ["owner", "admin", "moderator"],
    delete: ["owner", "admin"],
    export: ["owner", "admin", "moderator", "member"],
    transcribe: ["owner", "admin", "moderator", "member"],
  },
  // Policy permissions
  policies: {
    view: ["owner", "admin", "moderator", "member", "guest"],
    create: ["owner", "admin", "moderator"],
    edit: ["owner", "admin", "moderator"],
    delete: ["owner", "admin"],
    approve: ["owner", "admin"],
  },
  // Task permissions
  tasks: {
    view: ["owner", "admin", "moderator", "member", "guest"],
    create: ["owner", "admin", "moderator"],
    edit: ["owner", "admin", "moderator"],
    delete: ["owner", "admin", "moderator"],
    assign: ["owner", "admin", "moderator"],
  },
  // Calendar permissions
  calendar: {
    view: ["owner", "admin", "moderator", "member", "guest"],
    create: ["owner", "admin", "moderator"],
    edit: ["owner", "admin", "moderator"],
    delete: ["owner", "admin", "moderator"],
  },
  // AI Search permissions
  ai_search: {
    view: ["owner", "admin", "moderator", "member", "guest"],
    search: ["owner", "admin", "moderator", "member"],
  },
  // Team Members permissions
  team_members: {
    view: ["owner", "admin", "moderator", "member", "guest"],
    invite: ["owner", "admin", "moderator"],
    remove: ["owner", "admin"],
    change_role: ["owner", "admin"],
  },
  // Organization permissions
  organizations: {
    view: ["owner", "admin", "moderator", "member", "guest"],
    create: ["owner", "admin"],
    edit: ["owner", "admin"],
    delete: ["owner"],
    leave: ["owner", "admin", "moderator", "member", "guest"],
  },
  // Settings permissions
  settings: {
    view: ["owner", "admin", "moderator"],
    edit: ["owner", "admin"],
  },
  // Reports permissions
  reports: {
    view: ["owner", "admin", "moderator"],
    export: ["owner", "admin", "moderator"],
  },
  // Admin Panel permissions
  admin_panel: {
    view: ["owner", "admin"],
    manage: ["owner", "admin"],
  },
  // Knowledge Base permissions
  knowledge: {
    view: ["owner", "admin", "moderator", "member", "guest"],
    create: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin", "moderator", "member"],
    delete: ["owner", "admin", "moderator"],
    // Merging/consolidating memories mutates the graph in bulk, so it's
    // restricted like other structural knowledge-base changes.
    consolidate: ["owner", "admin", "moderator"],
    // Running a contradiction scan or resolving a conflict mutates graph
    // metadata (status/supersededByMemory) for other users' memories, so
    // it's restricted the same way as consolidate.
    resolve_conflicts: ["owner", "admin", "moderator"],
  },
  // Notifications permissions
  notifications: {
    view: ["owner", "admin", "moderator", "member", "guest"],
    manage: ["owner", "admin"],
  },
  // Audit Logs permissions
  audit_logs: {
    view: ["owner", "admin"],
  },
};

/**
 * Check if a role has permission for a specific action on a resource
 * @param {string} role - User's role
 * @param {string} resource - Resource type (e.g., 'meetings', 'policies')
 * @param {string} action - Action type (e.g., 'view', 'create', 'edit', 'delete')
 * @returns {boolean}
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

/**
 * Check if a role has any of the specified permissions
 * @param {string} role - User's role
 * @param {string} resource - Resource type
 * @param {string[]} actions - Array of actions to check
 * @returns {boolean}
 */
export const hasAnyPermission = (role, resource, actions) => {
  return actions.some((action) => hasPermission(role, resource, action));
};

/**
 * Check if a role has all of the specified permissions
 * @param {string} role - User's role
 * @param {string} resource - Resource type
 * @param {string[]} actions - Array of actions to check
 * @returns {boolean}
 */
export const hasAllPermissions = (role, resource, actions) => {
  return actions.every((action) => hasPermission(role, resource, action));
};

/**
 * Check if role1 has higher or equal hierarchy than role2
 * @param {string} role1 - First role
 * @param {string} role2 - Second role
 * @returns {boolean}
 */
export const hasHigherOrEqualRole = (role1, role2) => {
  return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[role2];
};

/**
 * Get all permissions for a specific role
 * @param {string} role - User's role
 * @returns {Object} - Object containing all permissions for the role
 */
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

/**
 * Validate if a role is valid
 * @param {string} role - Role to validate
 * @returns {boolean}
 */
export const isValidRole = (role) => {
  return ROLE_HIERARCHY.hasOwnProperty(role);
};
