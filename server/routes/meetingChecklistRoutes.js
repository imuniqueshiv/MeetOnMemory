import express from "express";

import * as meetingChecklistController from "../controllers/meetingChecklistController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router({ mergeParams: true });

// Every checklist endpoint is authenticated. Controllers additionally resolve
// the meeting and enforce organization + meeting/RBAC permissions.
router.use(userAuth);

router.post("/", meetingChecklistController.createChecklist);
router.put("/", meetingChecklistController.updateChecklist);
router.get("/", meetingChecklistController.getChecklist);
router.patch("/toggle", meetingChecklistController.toggleItem);
router.delete("/", meetingChecklistController.deleteChecklist);
router.get("/readiness", meetingChecklistController.getReadiness);

export default router;
