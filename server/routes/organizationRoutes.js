// server/routes/organizationRoutes.js
import express from "express";
import {
  createOrJoinOrganization,
  getAllOrganizations,
  joinOrganization,
} from "../controllers/organizationController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

// Unified endpoint: handles both "create new" and "join existing" organizations
router.post("/create-or-join", userAuth, createOrJoinOrganization);

// Member joins by selecting an existing org
router.post("/join", userAuth, joinOrganization);

// Fetch all organizations (list) - usable for the join UI
router.get("/", userAuth, getAllOrganizations);

export default router;
