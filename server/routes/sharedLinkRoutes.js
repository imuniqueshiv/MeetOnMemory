import express from "express";
import {
  createLink,
  getActiveLinksFixed,
  revokeLink,
} from "../controllers/sharedLinkController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

// Apply auth middleware to all routes in this file
router.use(userAuth);

router.post("/", createLink);
router.get("/:resourceType/:resourceId", getActiveLinksFixed);
router.delete("/:id", revokeLink);

export default router;
