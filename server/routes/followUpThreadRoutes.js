import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  createThread,
  getThreadsByMeetingId,
  createReply,
  updateReply,
  deleteReply,
  resolveThread,
} from "../controllers/followUpThreadController.js";

const router = express.Router();

router.post("/meeting/:meetingId", userAuth, createThread);
router.get("/meeting/:meetingId", userAuth, getThreadsByMeetingId);

router.post("/:threadId/replies", userAuth, createReply);
router.put("/replies/:replyId", userAuth, updateReply);
router.delete("/replies/:replyId", userAuth, deleteReply);

router.put("/:threadId/resolve", userAuth, resolveThread);

export default router;
