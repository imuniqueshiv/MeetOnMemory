import express from "express";
import {
  createLink,
  getActiveLinks,
  revokeLink,
} from "../controllers/sharedLinkController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership } from "../middleware/rbac.js";

const router = express.Router();

// Apply auth & org membership middleware to all routes in this file
router.use(userAuth);
router.use(requireOrgMembership);

router.post("/", createLink);
router.get("/:resourceType/:resourceId", getActiveLinks);
router.delete("/:id", revokeLink);

export default router;
