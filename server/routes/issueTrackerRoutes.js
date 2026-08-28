import express from "express";
import {
  getConfig,
  updateConfig,
  getSyncStatus,
  disconnect,
} from "../controllers/issueTrackerController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(userAuth);

router.get("/:provider/config", getConfig);
router.get("/:provider/sync-status", getSyncStatus);
router.post("/:provider/config", updateConfig);
router.delete("/:provider/disconnect", disconnect);

export default router;
