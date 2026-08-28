import express from "express";
import {
  getNoteTemplates,
  createNoteTemplate,
  getNoteTemplateById,
  updateNoteTemplate,
  deleteNoteTemplate,
  applyNoteTemplate,
} from "../controllers/meetingNoteTemplateController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getNoteTemplates).post(createNoteTemplate);

router
  .route("/:id")
  .get(getNoteTemplateById)
  .put(updateNoteTemplate)
  .delete(deleteNoteTemplate);

router.post("/:id/apply", applyNoteTemplate);

export default router;
