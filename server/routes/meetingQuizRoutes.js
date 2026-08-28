import express from "express";
import {
  getQuizForMeeting,
  submitQuizResponse,
  getQuizAnalytics,
} from "../controllers/meetingQuizController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router({ mergeParams: true });

router.use(userAuth);

router.get("/", getQuizForMeeting);
router.post("/submit", submitQuizResponse);
router.get("/analytics", getQuizAnalytics);

export default router;
