import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireAdminOrOwner } from "../middleware/rbac.js";
import {
  initiateOAuth,
  oauthCallback,
  getDatabases,
  saveMapping,
  getStatus,
  disconnect,
  syncMeeting,
  getSyncHistory,
} from "../controllers/notionIntegrationController.js";

const router = express.Router();

// Public route for OAuth callback (no session cookie yet)
router.get("/callback", oauthCallback);

// Protected routes
router.use(userAuth);

router.get("/auth", requireAdminOrOwner, initiateOAuth);
router.get("/status", requireAdminOrOwner, getStatus);
router.get("/databases", requireAdminOrOwner, getDatabases);
router.get("/history", requireAdminOrOwner, getSyncHistory);
router.post("/mapping", requireAdminOrOwner, saveMapping);
router.post("/sync", requireAdminOrOwner, syncMeeting);
router.delete("/disconnect", requireAdminOrOwner, disconnect);

export default router;
