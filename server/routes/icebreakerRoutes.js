import express from "express";
import {
  generate,
  select,
  getActiveIcebreaker,
} from "../controllers/icebreakerController.js";
import protect from "../middleware/userAuth.js"; // Standard auth middleware

const router = express.Router();

// Apply auth middleware to all routes in this router
router.use(protect);

router.post("/generate", generate);
router.post("/select", select);
router.get("/meeting/:meetingId", getActiveIcebreaker);

export default router;
