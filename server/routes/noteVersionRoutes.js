import express from "express";
import * as noteVersionController from "../controllers/noteVersionController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgAccess, requirePermission } from "../middleware/rbac.js";
import {
  requireNoteVersionAccess,
  requireVersionedField,
} from "../middleware/noteVersionAccess.js";
import Meeting from "../models/meetingModel.js";

const router = express.Router();

// Issue #1158 — this file used to be `router.use(userAuth)` followed by five
// bare routes. `userAuth` establishes *who* the caller is; nothing established
// *what* they were allowed to reach, and the handlers did not check either.
//
// Every route below now resolves the meeting behind the requested resource
// before the handler runs:
//
//   - `/:meetingId/...` has the meeting id in the path, so `requireOrgAccess`
//     applies directly — the same guard `followUpThreadRoutes` and
//     `agendaTimerRoutes` already use.
//   - `/version/:versionId` does not, so `requireNoteVersionAccess` walks
//     `NoteVersion -> Meeting` and applies the identical rule.
//
// Reads require `meetings:view`. `restoreVersion` mutates the meeting, so it
// requires `meetings:edit` — the same view/edit split `meetingSeriesRoutes`
// already draws.

router.use(userAuth);

router.get(
  "/:meetingId/:field/history",
  requireVersionedField,
  requireOrgAccess(Meeting),
  requirePermission("meetings", "view"),
  noteVersionController.getVersionHistory,
);

router.get(
  "/version/:versionId",
  requireNoteVersionAccess,
  requirePermission("meetings", "view"),
  noteVersionController.getVersionContent,
);

router.get(
  "/version/:versionId/diff",
  requireNoteVersionAccess,
  requirePermission("meetings", "view"),
  noteVersionController.getVersionDiff,
);

router.get(
  "/version/:versionId/diff/:compareVersionId",
  requireNoteVersionAccess,
  requirePermission("meetings", "view"),
  noteVersionController.getVersionDiff,
);

router.post(
  "/version/:versionId/restore",
  requireNoteVersionAccess,
  requirePermission("meetings", "edit"),
  noteVersionController.restoreVersion,
);

export default router;
