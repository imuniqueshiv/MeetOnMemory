import express from "express";
import {
  getNotionAuthUrl,
  handleNotionCallback,
  updateTargetDatabase,
  syncMeetingToNotion
} from "../controllers/notionIntegrationController.js";
import { notionAuthGuard } from "../middleware/notionAuthGuard.js";

const router = express.Router();

router.get("/oauth/url", getNotionAuthUrl);
router.post("/oauth/callback", handleNotionCallback);
router.post("/database", notionAuthGuard, updateTargetDatabase);
router.post("/sync", notionAuthGuard, syncMeetingToNotion);

export default router;
