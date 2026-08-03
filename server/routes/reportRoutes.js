import express from "express";
import {
  getReportTemplates,
  getReportTemplate,
  createReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
  generateReportData,
} from "../controllers/reportController.js";

const router = express.Router();

router.route("/templates").get(getReportTemplates).post(createReportTemplate);

router
  .route("/templates/:id")
  .get(getReportTemplate)
  .put(updateReportTemplate)
  .delete(deleteReportTemplate);

router.post("/generate/:id", generateReportData);

export default router;
