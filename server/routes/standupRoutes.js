import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  getMyReports,
  getTeamReports,
  generateManualReport,
  getPreferences,
  updatePreferences,
} from "../controllers/standupReportController.js";
import {
  getStandupReport,
  createStandupReport,
} from "../controllers/standupController.js";

const router = express.Router();

// All routes require user authentication
router.use(userAuth);

// 1. Standard CRUD and Async Standup Surface
router.get("/my", getMyReports);
router.get("/team", getTeamReports);
router.post("/generate", generateManualReport);
router.get("/preferences", getPreferences);
router.put("/preferences", updatePreferences);

// 2. Report Generation Endpoints
router.get("/report", getStandupReport);
router.post("/report", createStandupReport);

export default router;
