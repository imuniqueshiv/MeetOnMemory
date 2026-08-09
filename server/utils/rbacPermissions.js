// server/utils/rbacPermissions.js
// Centralized RBAC Permission System

/**
 * Role hierarchy (higher number = more permissions)
 *
 * Issue #1117: Viewer role fully supported across the system
 *
 * Hierarchy:
 * - Owner (5): Full control, can delete organization
 * - Admin (4): Full management, can invite/remove users
 * - Moderator (3): Content management, can moderate
 * - Member (2): Standard access, can create/edit content
 * - Viewer (1): Read-only access, cannot create/edit
 * - Guest (0): Minimal access, public content only
 */
export const ROLE_HIERARCHY = {
  owner: 5,
  admin: 4,
  moderator: 3,
  member: 2,
  viewer: 1,
  guest: 0,
};

/**
 * Resource permissions
 *
 * Each resource defines actions and which roles can perform them.
 * Viewer role has read-only access to most resources.
 */
export const PERMISSIONS = {
  // Meeting permissions
  // Viewers can view meetings but cannot create, edit, delete, or export
  meetings: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    create: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin", "moderator", "member"],
    delete: ["owner", "admin"],
    export: ["owner", "admin", "moderator", "member"],
    transcribe: ["owner", "admin", "moderator", "member"],
  },

  // Policy permissions
  // Viewers can view policies but cannot create, edit, delete, or approve
  policies: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    create: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin", "moderator", "member"],
    delete: ["owner", "admin"],
    approve: ["owner", "admin"],
  },

  // Task permissions
  // Viewers can view tasks but cannot create, edit, delete, or assign
  tasks: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    create: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin", "moderator", "member"],
    delete: ["owner", "admin", "moderator"],
    assign: ["owner", "admin", "moderator"],
  },

  // Calendar permissions
  // Viewers can view calendar but cannot create, edit, or delete events
  calendar: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    create: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin", "moderator", "member"],
    delete: ["owner", "admin", "moderator"],
  },

  // AI Search permissions
  // Viewers can view and search (read-only operations)
  ai_search: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    search: ["owner", "admin", "moderator", "member", "viewer"],
  },

  // Team Members permissions
  // Viewers can view team members but cannot invite, remove, or change roles
  team_members: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    invite: ["owner", "admin"],
    remove: ["owner", "admin"],
    change_role: ["owner", "admin"],
  },

  // Organization permissions
  // Viewers can view and leave organizations but cannot create, edit, or delete
  organizations: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    create: ["owner", "admin"],
    edit: ["owner", "admin"],
    delete: ["owner"],
    leave: ["owner", "admin", "moderator", "member", "viewer", "guest"],
  },

  // Settings permissions
  // Viewers can view their own settings but cannot edit organization settings
  settings: {
    view: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin"],
    self_view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    self_edit: ["owner", "admin", "moderator", "member", "viewer", "guest"],
  },

  // Reports permissions
  // Viewers CANNOT view reports (reports contain sensitive analytics)
  reports: {
    view: ["owner", "admin", "moderator", "member"],
    export: ["owner", "admin", "moderator"],
  },

  // Analytics permissions (including attendance analytics)
  // Viewers CANNOT view analytics (contains sensitive organizational data)
  analytics: {
    view: ["owner", "admin", "moderator"],
    export: ["owner", "admin"],
    manage: ["owner", "admin"],
  },

  // Admin Panel permissions
  // Viewers CANNOT access admin panel
  admin_panel: {
    view: ["owner", "admin"],
    manage: ["owner", "admin"],
  },

  // Knowledge Base permissions
  // Viewers can view knowledge base but cannot create, edit, delete, or manage
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
  // Viewers can view and manage their own notifications
  notifications: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    manage: ["owner", "admin"],
    self_manage: ["owner", "admin", "moderator", "member", "viewer", "guest"],
  },

  // Audit Logs permissions
  // Viewers CANNOT view audit logs (contains sensitive activity data)
  audit_logs: {
    view: ["owner", "admin"],
  },

  // Automation Rules permissions (org admins / owners only)
  // Viewers CANNOT view or manage automation rules
  automation_rules: {
    view: ["owner", "admin"],
    create: ["owner", "admin"],
    edit: ["owner", "admin"],
    delete: ["owner", "admin"],
  },

  // Digest Preferences permissions
  // Viewers can manage their own digest preferences
  digest_preferences: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    edit: ["owner", "admin", "moderator", "member", "viewer", "guest"],
  },

  // Comments permissions
  // Viewers can view comments but cannot create, edit, or delete
  comments: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    create: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin", "moderator", "member"],
    delete: ["owner", "admin", "moderator"],
    react: ["owner", "admin", "moderator", "member", "viewer"],
  },

  // Attachments permissions
  // Viewers can view attachments but cannot upload, edit, or delete
  attachments: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    upload: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin", "moderator", "member"],
    delete: ["owner", "admin", "moderator"],
    download: ["owner", "admin", "moderator", "member", "viewer"],
  },

  // Bookmarks permissions
  // Viewers can manage their own bookmarks
  bookmarks: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    create: ["owner", "admin", "moderator", "member", "viewer"],
    edit: ["owner", "admin", "moderator", "member", "viewer"],
    delete: ["owner", "admin", "moderator", "member", "viewer"],
  },

  // Personal Notes permissions
  // Viewers can manage their own personal notes
  personal_notes: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    create: ["owner", "admin", "moderator", "member", "viewer"],
    edit: ["owner", "admin", "moderator", "member", "viewer"],
    delete: ["owner", "admin", "moderator", "member", "viewer"],
    pin: ["owner", "admin", "moderator", "member", "viewer"],
  },

  // Shared Links permissions
  // Viewers can view shared links but cannot create or manage
  shared_links: {
    view: ["owner", "admin", "moderator", "member", "viewer", "guest"],
    create: ["owner", "admin", "moderator", "member"],
    edit: ["owner", "admin", "moderator", "member"],
    delete: ["owner", "admin", "moderator"],
    revoke: ["owner", "admin", "moderator"],
  },
};

/**
 * Check if a role has permission for a specific action on a resource
 *
 * @param {string} role - User role (owner, admin, moderator, member, viewer, guest)
 * @param {string} resource - Resource name (meetings, policies, tasks, etc.)
 * @param {string} action - Action name (view, create, edit, delete, etc.)
 * @returns {boolean} True if role has permission
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
 * Check if a role has ANY of the specified permissions
 *
 * @param {string} role - User role
 * @param {string} resource - Resource name
 * @param {Array<string>} actions - Array of action names
 * @returns {boolean} True if role has at least one permission
 */
export const hasAnyPermission = (role, resource, actions) => {
  return actions.some((action) => hasPermission(role, resource, action));
};

/**
 * Check if a role has ALL of the specified permissions
 *
 * @param {string} role - User role
 * @param {string} resource - Resource name
 * @param {Array<string>} actions - Array of action names
 * @returns {boolean} True if role has all permissions
 */
export const hasAllPermissions = (role, resource, actions) => {
  return actions.every((action) => hasPermission(role, resource, action));
};

/**
 * Check if role1 is higher or equal to role2 in hierarchy
 *
 * @param {string} role1 - First role
 * @param {string} role2 - Second role
 * @returns {boolean} True if role1 >= role2
 */
export const hasHigherOrEqualRole = (role1, role2) => {
  return (ROLE_HIERARCHY[role1] || 0) >= (ROLE_HIERARCHY[role2] || 0);
};

/**
 * Get all permissions for a specific role
 *
 * @param {string} role - User role
 * @returns {Object} Map of resource -> action -> boolean
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
 * Check if a role is valid (exists in ROLE_HIERARCHY)
 *
 * @param {string} role - Role name
 * @returns {boolean} True if role is valid
 */
export const isValidRole = (role) => {
  return Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, role);
};

/**
 * Get role display name
 *
 * @param {string} role - Role key
 * @returns {string} Display name
 */
export const getRoleDisplayName = (role) => {
  const displayNames = {
    owner: "Owner",
    admin: "Administrator",
    moderator: "Moderator",
    member: "Member",
    viewer: "Viewer",
    guest: "Guest",
  };
  return displayNames[role] || role;
};

/**
 * Get role description
 *
 * @param {string} role - Role key
 * @returns {string} Role description
 */
export const getRoleDescription = (role) => {
  const descriptions = {
    owner: "Full control over the organization, including deletion",
    admin: "Full management capabilities, can invite and remove users",
    moderator: "Content management and moderation privileges",
    member: "Standard access with ability to create and edit content",
    viewer: "Read-only access to view content without editing",
    guest: "Minimal access to public content only",
  };
  return descriptions[role] || "No description available";
};

/**
 * Get all valid roles
 *
 * @returns {Array<string>} Array of valid role names
 */
export const getValidRoles = () => {
  return Object.keys(ROLE_HIERARCHY);
};

/**
 * Get roles that can perform a specific action on a resource
 *
 * @param {string} resource - Resource name
 * @param {string} action - Action name
 * @returns {Array<string>} Array of roles that have permission
 */
export const getRolesWithPermission = (resource, action) => {
  const resourcePermissions = PERMISSIONS[resource];
  if (!resourcePermissions || !resourcePermissions[action]) {
    return [];
  }
  return resourcePermissions[action];
};
