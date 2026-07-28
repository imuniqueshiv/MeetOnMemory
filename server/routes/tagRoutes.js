import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  requireAdminOrOwner,
  requireOrgMembership,
} from "../middleware/rbac.js";
import { apiLimiter } from "../middleware/rateLimiter.js";
import {
  createTag,
  getOrgTags,
  updateTag,
  deleteTag,
  autocomplete,
  getMeetingsByTag,
  getTagStats,
} from "../controllers/tagController.js";

const router = express.Router();

// Apply auth to all tag routes
router.use(userAuth);
router.use(apiLimiter);

// ==========================================
// TAG MANAGEMENT ROUTES
// ==========================================

// Autocomplete tags (used during meeting creation)
router.get("/autocomplete", requireOrgMembership, autocomplete);

// Get tag statistics (top tags)
router.get("/stats", requireOrgMembership, getTagStats);

// Get all tags for the organization
router.get("/", requireOrgMembership, getOrgTags);

// Create a new tag (admin only)
router.post("/", requireAdminOrOwner, createTag);

// Get meetings for a specific tag
router.get("/:name/meetings", requireOrgMembership, getMeetingsByTag);

// Update a tag (admin only)
router.put("/:id", requireAdminOrOwner, updateTag);

// Delete a tag (admin only)
router.delete("/:id", requireAdminOrOwner, deleteTag);

export default router;
