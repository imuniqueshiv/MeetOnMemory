import express from "express";
import {
  createOrJoinOrganization,
  getAllOrganizations
} from "../controllers/organizationController.js";
import userAuth from "../middleware/userAuth.js"; // Your existing auth middleware

const router = express.Router();

// ✅ Unified endpoint: handles both "create new" and "join existing" organizations
router.post("/create-or-join", userAuth, createOrJoinOrganization);

// ✅ Optional: Fetch all organizations
router.get("/", userAuth, getAllOrganizations);

export default router;
