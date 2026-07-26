// server/routes/invitationRoutes.js
import express from "express";
import {
  createInvitation,
  getOrganizationInvitations,
  getUserInvitations,
  acceptInvitation,
  rejectInvitation,
  revokeInvitation,
  getInvitationByToken,
  resendInvitation,
  expireInvitation,
} from "../controllers/invitationController.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import { requirePermission, requireOrgMembership } from "../middleware/rbac.js";

const router = express.Router();

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes except getInvitationByToken require authentication
router.post(
  "/",
  userAuth,
  writeLimiter,
  requirePermission("team_members", "invite"),
  createInvitation,
);
router.get(
  "/organization/:organizationId",
  userAuth,
  requireOrgMembership,
  requirePermission("team_members", "view"),
  getOrganizationInvitations,
);
router.get(
  "/user",
  userAuth,
  requirePermission("team_members", "view"),
  getUserInvitations,
);
router.post(
  "/:token/accept",
  userAuth,
  writeLimiter,
  requirePermission("organizations", "leave"),
  acceptInvitation,
);
router.post(
  "/:token/reject",
  userAuth,
  writeLimiter,
  requirePermission("organizations", "leave"),
  rejectInvitation,
);
router.delete(
  "/:id",
  userAuth,
  writeLimiter,
  requirePermission("team_members", "remove"),
  revokeInvitation,
);
router.post(
  "/:id/resend",
  userAuth,
  writeLimiter,
  requirePermission("team_members", "invite"),
  resendInvitation,
);
router.post(
  "/:id/expire",
  userAuth,
  writeLimiter,
  requirePermission("team_members", "invite"),
  expireInvitation,
);
router.get("/:token", getInvitationByToken);

export default router;
