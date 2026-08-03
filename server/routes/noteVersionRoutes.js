import express from "express";
import * as noteVersionController from "../controllers/noteVersionController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

router.use(userAuth);

router.get(
  "/:meetingId/:field/history",
  noteVersionController.getVersionHistory,
);
router.get("/version/:versionId", noteVersionController.getVersionContent);
router.get("/version/:versionId/diff", noteVersionController.getVersionDiff);
router.get(
  "/version/:versionId/diff/:compareVersionId",
  noteVersionController.getVersionDiff,
);
router.post(
  "/version/:versionId/restore",
  noteVersionController.restoreVersion,
);

export default router;
