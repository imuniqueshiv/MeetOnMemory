import express from "express";
import {
  startAgendaItem,
  stopAgendaItem,
  skipAgendaItem,
  getAgendaPacingReport,
} from "../controllers/agendaTimerController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

router.use(userAuth);

router.put("/:meetingId/agenda/:itemId/start", startAgendaItem);
router.put("/:meetingId/agenda/:itemId/stop", stopAgendaItem);
router.put("/:meetingId/agenda/:itemId/skip", skipAgendaItem);
router.get("/:meetingId/pacing", getAgendaPacingReport);

export default router;
