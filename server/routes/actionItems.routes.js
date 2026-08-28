import express from "express";
import * as actionItemsController from "../controllers/actionItems.controller.js";
import * as actionItemChangeLogController from "../controllers/actionItemChangeLogController.js";
import userAuth from "../middleware/userAuth.js";
import {
  verifyMeetingAccess,
  verifyActionItemAccess,
} from "../middleware/meetingAuth.js";

const router = express.Router();
router.use(userAuth);

router.post(
  "/meetings/:meetingId/extract-actions",
  verifyMeetingAccess,
  actionItemsController.extractFromMeeting,
);
router.get("/", actionItemsController.getActionItems);
router.get(
  "/meeting/:meetingId",
  verifyMeetingAccess,
  actionItemsController.getMeetingActionItems,
);
router.post(
  "/meetings/:meetingId",
  verifyMeetingAccess,
  actionItemsController.createActionItem,
);
router.patch(
  "/:id",
  verifyActionItemAccess,
  actionItemsController.updateActionItem,
);
router.delete(
  "/:id",
  verifyActionItemAccess,
  actionItemsController.deleteActionItem,
);

router.get(
  "/:id/changelog",
  verifyActionItemAccess,
  actionItemChangeLogController.getChangeLogs,
);

router.get(
  "/:id/changelog/stats",
  verifyActionItemAccess,
  actionItemChangeLogController.getChangeLogStats,
);

export default router;
