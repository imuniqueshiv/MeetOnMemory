import express from "express";
import {
  getPreferences,
  updatePreferences,
  previewRecapEmail,
} from "../controllers/recapPreferenceController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

router.use(userAuth); // Protect all routes

router.get("/preferences", getPreferences);
router.put("/preferences", updatePreferences);
router.post("/preview", previewRecapEmail); // POST so we can send preferences in body

export default router;
