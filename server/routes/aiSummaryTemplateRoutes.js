import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership } from "../middleware/rbac.js";
import {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
  testTemplate,
} from "../controllers/aiSummaryTemplateController.js";

const router = express.Router();

// All routes require user to be logged in and part of an organization
router.use(userAuth, requireOrgMembership);

router.post("/test", testTemplate);

router.route("/").post(createTemplate).get(getTemplates);

router
  .route("/:id")
  .get(getTemplateById)
  .put(updateTemplate)
  .delete(deleteTemplate);

router.put("/:id/default", setDefaultTemplate);

export default router;
