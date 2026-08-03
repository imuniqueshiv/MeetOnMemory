import express from "express";
import {
  submitFeedback,
  getFeedbackForMeeting,
  getAggregateFeedback,
  deleteFeedback,
} from "../controllers/meetingFeedbackController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(userAuth);

router.post("/", submitFeedback);
router.get("/meeting/:meetingId", getFeedbackForMeeting);
router.get("/aggregate/:orgId", getAggregateFeedback);
router.delete("/:id", deleteFeedback);

export default router;
