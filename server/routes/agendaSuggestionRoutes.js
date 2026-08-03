import express from "express";
import {
  generateAgenda,
  updateSuggestionItem,
  applyAgenda,
  getSuggestionsByMeeting,
} from "../controllers/agendaSuggestionController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

// Require authentication for all routes
router.use(userAuth);

router.post("/generate", generateAgenda);
router.put("/:id/item/:itemId", updateSuggestionItem);
router.post("/:id/apply", applyAgenda);
router.get("/meeting/:meetingId", getSuggestionsByMeeting);

export default router;
