import express from "express";
import {
  getApprovalStatus,
  submitApproval,
  respondApproval,
} from "../controllers/minutesApprovalController.js";
import { requireAuth } from "@clerk/express";

const router = express.Router({ mergeParams: true }); // mergeParams needed because meetingId is in the prefix

// /api/meetings/:meetingId/minutes-approval
router.get("/", requireAuth(), getApprovalStatus);
router.post("/submit", requireAuth(), submitApproval);
router.put("/respond", requireAuth(), respondApproval);

export default router;
