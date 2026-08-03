import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  getMappings,
  suggestMappings,
  saveAndApplyMapping,
  revertMapping,
} from "../controllers/speakerMappingController.js";

const router = express.Router();

router.use(userAuth);

router.get("/:meetingId", getMappings);
router.get("/:meetingId/suggest", suggestMappings);
router.post("/:meetingId", saveAndApplyMapping);
router.delete("/:meetingId/:mappingId", revertMapping);

export default router;
