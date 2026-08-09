// server/routes/invitationRoutes.js
import express from "express";
import multer from "multer";
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
  bulkImportInvitations,
} from "../controllers/invitationController.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import { requirePermission, requireOrgMembership } from "../middleware/rbac.js";

const router = express.Router();

// Configure multer for CSV file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1 * 1024 * 1024, // 1 MB max
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"), false);
    }
  },
});

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
router.post("/:token/accept", userAuth, writeLimiter, acceptInvitation);
router.post("/:token/reject", userAuth, writeLimiter, rejectInvitation);
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
router.post(
  "/bulk",
  userAuth,
  writeLimiter,
  requirePermission("team_members", "invite"),
  upload.single("file"),
  bulkImportInvitations,
);
router.get("/:token", getInvitationByToken);

export default router;
