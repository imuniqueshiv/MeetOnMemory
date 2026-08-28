import express from "express";
import {
  requestToShadow,
  approveShadowRequest,
  denyShadowRequest,
} from "../controllers/observerController.js";
import protect from "../middleware/userAuth.js";

const router = express.Router();

router.post("/:meetingId/request", protect, requestToShadow);
router.put("/:meetingId/approve/:userId", protect, approveShadowRequest);
router.put("/:meetingId/deny/:userId", protect, denyShadowRequest);

export default router;
