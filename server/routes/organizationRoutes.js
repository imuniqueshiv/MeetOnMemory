// server/routes/organizationRoutes.js
import express from "express";
import {
  createOrJoinOrganization,
  getAllOrganizations,
  joinOrganization,
  selectOrganization,
  getOrganizationMembers,
  getPublicOrganizationBySlug,
  browsePublicOrganizations,
  searchOrganizations,
  getUserOrganizations,
  createOrganization,
  getOrganizations,
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
  getOrganizationMembersById,
} from "../controllers/organizationController.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import { requirePermission, requireOrgMembership } from "../middleware/rbac.js";

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// Fetch user's joined organizations
router.get("/user", userAuth, getUserOrganizations);

// Unified endpoint: handles both "create new" and "join existing" organizations
router.post(
  "/create-or-join",
  userAuth,
  writeLimiter,
  createOrJoinOrganization,
);

// Member joins by selecting an existing org
router.post(
  "/join",
  userAuth,
  writeLimiter,
  joinOrganization,
);

// Select organization (for users with multiple orgs)
router.post("/select", userAuth, selectOrganization);

// Fetch all organizations (list) - usable for the join UI
router.get(
  "/",
  userAuth,
  requirePermission("organizations", "view"),
  getAllOrganizations,
);

// Fetch organization members
router.get(
  "/members",
  userAuth,
  requireOrgMembership,
  requirePermission("team_members", "view"),
  getOrganizationMembers,
);

// Public organization profile by slug (no auth required)
router.get("/public/:slug", getPublicOrganizationBySlug);
// Browse public organizations with pagination and filters
router.get(
  "/browse",
  userAuth,
  requirePermission("organizations", "view"),
  browsePublicOrganizations,
);

// Search organizations (public only)
router.get(
  "/search",
  userAuth,
  requirePermission("organizations", "view"),
  searchOrganizations,
);

import {
  downloadAuditLogExport,
  getAuditLogExport,
  getOrganizationAuditLogs,
} from "../controllers/auditLogController.js";
import Organization from "../models/organizationModel.js";
import { requireOrgAccess } from "../middleware/rbac.js";

// Fetch organization audit logs
router.get(
  "/:id/audit-logs",
  userAuth,
  requireOrgAccess(Organization),
  requirePermission("audit_logs", "view"),
  getOrganizationAuditLogs,
);

router.get(
  "/:id/audit-log-exports/:exportId",
  userAuth,
  requireOrgAccess(Organization),
  requirePermission("audit_logs", "view"),
  getAuditLogExport,
);

router.get(
  "/:id/audit-log-exports/:exportId/download",
  userAuth,
  requireOrgAccess(Organization),
  requirePermission("audit_logs", "view"),
  downloadAuditLogExport,
);

// New CRUD routes (consolidated from organizationRoutesNew.js)
router.post("/", userAuth, createOrganization);
router.get("/paginated", userAuth, getOrganizations);
router.get("/:idOrSlug", userAuth, getOrganizationById);
router.put("/:id", userAuth, updateOrganization);
router.delete("/:id", userAuth, deleteOrganization);
router.get("/:id/members", userAuth, getOrganizationMembersById);

export default router;
