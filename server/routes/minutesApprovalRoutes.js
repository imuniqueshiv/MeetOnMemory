import express from "express";
import {
  getApprovalStatus,
  submitApproval,
  respondApproval,
} from "../controllers/minutesApprovalController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router({ mergeParams: true }); // mergeParams needed because meetingId is in the prefix

// /api/meetings/:meetingId/minutes-approval
router.get("/", userAuth, getApprovalStatus);
router.post("/submit", userAuth, submitApproval);
router.put("/respond", userAuth, respondApproval);

export default router;
