import express from "express";
import {
  createComment,
  getCommentsByMeeting,
  updateComment,
  deleteComment,
  toggleReaction,
} from "../controllers/commentController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

router.use(userAuth);

router.post("/", createComment);
router.get("/meeting/:meetingId", getCommentsByMeeting);
router.patch("/:id", updateComment);
router.delete("/:id", deleteComment);
router.post("/:id/reactions", toggleReaction);

export default router;
