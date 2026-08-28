import express from "express";
import protect from "../middleware/userAuth.js";
import {
  getMyCatchUps,
  markCatchUpAsRead,
  deliverCatchUp,
  getMeetingCatchUp,
  generateMeetingCatchUp,
} from "../controllers/absenteeCatchUpController.js";

const router = express.Router();

router.use(protect); // All routes require authentication

router.get("/pending", getMyCatchUps);
router.get("/meeting/:meetingId", getMeetingCatchUp);
router.post("/meeting/:meetingId/generate", generateMeetingCatchUp);
router.post("/:id/mark-read", markCatchUpAsRead);
router.post("/:id/deliver", deliverCatchUp);

export default router;
