import express from "express";
import {
  logout,
  isAuthenticated,
  getUserData,
  syncClerkUser,
} from "../controllers/authControllers.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

// Clerk identity sync + session probes (Mongo user remains authorization SoT)
router.post("/logout", logout);
router.post("/sync-clerk-user", userAuth, syncClerkUser);
router.get("/user-data", userAuth, getUserData);
router.get("/is-auth", userAuth, isAuthenticated);

export default router;
