import express from "express";
import {
  createAsyncMeeting,
  getAsyncMeetings,
  getAsyncMeetingById,
  submitUpdate,
} from "../controllers/asyncMeetingController.js";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.use(apiLimiter);
router.use(userAuth);

router.post("/", writeLimiter, createAsyncMeeting);
router.get("/", getAsyncMeetings);
router.get("/:id", getAsyncMeetingById);
router.post("/:id/submit", writeLimiter, submitUpdate);

export default router;
