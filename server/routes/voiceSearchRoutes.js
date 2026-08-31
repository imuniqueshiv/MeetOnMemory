import express from "express";
import { handleVoiceQuery } from "../controllers/voiceSearchController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);

router.post("/query", handleVoiceQuery);

export default router;
