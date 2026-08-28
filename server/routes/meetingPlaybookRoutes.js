import express from "express";
import {
  createPlaybook,
  getPlaybooks,
  getPlaybook,
  updatePlaybook,
  deletePlaybook,
  generateAIPlaybook,
} from "../controllers/meetingPlaybookController.js";
import protect from "../middleware/userAuth.js";

const router = express.Router();

// All playbook routes require authentication
router.use(protect);

router.post("/", createPlaybook);
router.get("/", getPlaybooks);
router.post("/generate", generateAIPlaybook);
router.get("/:id", getPlaybook);
router.put("/:id", updatePlaybook);
router.delete("/:id", deletePlaybook);

export default router;
