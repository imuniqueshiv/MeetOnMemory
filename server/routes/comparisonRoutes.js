import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  compareMeetings,
  getComparableMeetings,
} from "../controllers/comparisonController.js";

const router = express.Router();

router.post("/compare", userAuth, compareMeetings);
router.get("/comparable/:meetingId", userAuth, getComparableMeetings);

export default router;
