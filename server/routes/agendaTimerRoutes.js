import express from "express";
import {
  startAgendaItem,
  stopAgendaItem,
  skipAgendaItem,
  getAgendaPacingReport,
} from "../controllers/agendaTimerController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgAccess, requirePermission } from "../middleware/rbac.js";
import Meeting from "../models/meetingModel.js";

const router = express.Router();

router.use(userAuth);

// Issue #1159 — the read-only pacing route was given `requireOrgAccess` and
// `requirePermission` (for #817); the three *mutating* routes were left with
// `userAuth` alone. Their only check was the controller's `hasPermission`,
// which treated "is an admin or owner" as sufficient without reference to the
// meeting's organization — so an admin of any tenant could drive the timer on
// any meeting, and the resulting `agenda_timer_updated` broadcast landed in the
// victim's meeting room.
//
// Starting, stopping and skipping change the meeting document, so they require
// `meetings:edit` rather than `meetings:view`.

router.put(
  "/:meetingId/agenda/:itemId/start",
  requireOrgAccess(Meeting),
  requirePermission("meetings", "edit"),
  startAgendaItem,
);
router.put(
  "/:meetingId/agenda/:itemId/stop",
  requireOrgAccess(Meeting),
  requirePermission("meetings", "edit"),
  stopAgendaItem,
);
router.put(
  "/:meetingId/agenda/:itemId/skip",
  requireOrgAccess(Meeting),
  requirePermission("meetings", "edit"),
  skipAgendaItem,
);
router.get(
  "/:meetingId/pacing",
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  getAgendaPacingReport,
);

export default router;
