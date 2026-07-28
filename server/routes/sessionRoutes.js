import express from "express";
import { generateSession } from "../controllers/sessionController.js";
import userAuth from "../middleware/userAuth.js";
import { writeLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Generate session card
router.post("/generate", userAuth, writeLimiter, generateSession);

export default router;
