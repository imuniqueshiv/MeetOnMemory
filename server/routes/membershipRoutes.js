// server/routes/membershipRoutes.js
import express from "express";
import {
  getUserMemberships,
  getOrganizationMemberships,
  updateMembershipRole,
  removeMembership,
  leaveOrganization,
} from "../controllers/membershipController.js";
import userAuth from "../middleware/userAuth.js";
import { requireAdmin } from "../middleware/rbac.js"; // eslint-disable-line no-unused-vars
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import { requirePermission, requireOrgMembership } from "../middleware/rbac.js";

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes require authentication
router.use(userAuth);

// User memberships
router.get("/", requirePermission("team_members", "view"), getUserMemberships);

// Organization memberships
router.get(
  "/organization/:organizationId",
  requireOrgMembership,
  requirePermission("team_members", "view"),
  getOrganizationMemberships,
);

// Membership management
router.patch(
  "/:id/role",
  writeLimiter,
  requirePermission("team_members", "change_role"),
  updateMembershipRole,
);
router.delete(
  "/:id",
  writeLimiter,
  requirePermission("team_members", "remove"),
  removeMembership,
);

// Leave organization
router.post(
  "/leave/:organizationId",
  writeLimiter,
  requirePermission("organizations", "leave"),
  leaveOrganization,
);

export default router;
