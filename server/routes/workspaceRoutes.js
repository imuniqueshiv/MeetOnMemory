// server/routes/workspaceRoutes.js
import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  getWorkspaceState,
  addActionItem,
} from "../controllers/workspaceController.js";

const router = express.Router();

// All workspace routes require authentication
router.use(userAuth);

router.get("/:meetingId/state", getWorkspaceState);
router.post("/:meetingId/action", addActionItem);

export default router;
