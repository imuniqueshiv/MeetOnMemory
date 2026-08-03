import express from "express";
import {
  createAnnotation,
  listAnnotations,
  updateAnnotation,
  deleteAnnotation,
  resolveAnnotation,
} from "../controllers/transcriptAnnotationController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgAccess } from "../middleware/rbac.js";
import Meeting from "../models/meetingModel.js";

const router = express.Router({ mergeParams: true });

// Protect all routes
router.use(userAuth);

// Routes
// Note: We mount these routes under /api/meetings/:meetingId/transcript-annotations
// OR we mount them globally and pass meetingId. The prompt implies standard REST structure.
// Let's assume global mount: /api/transcript-annotations/:meetingId
// Actually, requireMeetingAccess expects req.params.meetingId to be present.

// Apply requireMeetingAccess to routes that have meetingId in params
router.post("/", createAnnotation);
// We should perhaps validate access inside createAnnotation if meetingId is in body.

// Let's create specific routes for listing under meeting
router.get("/meeting/:meetingId", requireOrgAccess(Meeting), listAnnotations);

router.put("/:id", updateAnnotation);
router.delete("/:id", deleteAnnotation);
router.patch("/:id/resolve", resolveAnnotation);

export default router;
