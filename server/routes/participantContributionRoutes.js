import express from "express";
import {
  getContributionsByMeeting,
  calculateContributions,
} from "../controllers/participantContributionController.js";
import auth from "../middleware/userAuth.js";

const router = express.Router({ mergeParams: true }); // Need mergeParams to access meetingId from parent router

// Routes relative to /api/meetings/:meetingId/contributions
router.get("/", auth, getContributionsByMeeting);
router.post("/calculate", auth, calculateContributions);

export default router;
