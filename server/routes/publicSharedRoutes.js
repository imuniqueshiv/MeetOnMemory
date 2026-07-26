import express from "express";
import {
  verifyPasscode,
  getPublicResource,
} from "../controllers/sharedLinkController.js";

import { apiLimiter, loginLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.post("/:hash/verify", loginLimiter, verifyPasscode);
router.get("/:hash", apiLimiter, getPublicResource);

export default router;
