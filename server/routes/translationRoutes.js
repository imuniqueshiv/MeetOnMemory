import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  getLanguages,
  requestTranslation,
  clearTranslationCache,
} from "../controllers/translationController.js";

const router = express.Router();

router.use(userAuth);

router.get("/languages", getLanguages);
router.post("/request", requestTranslation);
router.delete("/cache/:meetingId", clearTranslationCache);

export default router;
