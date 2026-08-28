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
  mergeTags,
  bulkRetag,
  exportTags,
} from "../controllers/tagController.js";

const router = express.Router();

// Apply auth to all tag routes
router.use(userAuth);
router.use(apiLimiter);

// ==========================================
// TAG MANAGEMENT & TAXONOMY ADMIN ROUTES
// ==========================================

// Autocomplete tags (used during meeting creation)
router.get("/autocomplete", requireOrgMembership, autocomplete);

// Export tag taxonomy stats (CSV)
router.get("/export", requireOrgMembership, exportTags);

// Get tag statistics (top tags)
router.get("/stats", requireOrgMembership, getTagStats);

// Merge tags (admin only)
router.post("/merge", requireAdminOrOwner, mergeTags);

// Bulk retag meetings (admin only)
router.post("/bulk-retag", requireAdminOrOwner, bulkRetag);

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
