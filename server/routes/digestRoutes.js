import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  getPreferences,
  updatePreferences,
  previewDigest,
  sendTestDigest,
} from "../controllers/digestPreferenceController.js";

const router = express.Router();

router
  .route("/")
  .get(userAuth, getPreferences)
  .put(userAuth, updatePreferences);

router.post("/preview", userAuth, previewDigest);
router.post("/test", userAuth, sendTestDigest);

export default router;
