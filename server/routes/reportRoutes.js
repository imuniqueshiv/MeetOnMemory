import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership, requirePermission } from "../middleware/rbac.js";
import {
  getReportTemplates,
  getReportTemplate,
  createReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
  generateReportData,
} from "../controllers/reportController.js";

const router = express.Router();

/**
 * Report template routes (Issue #1272).
 *
 * This router previously declared its routes with no middleware at all — it was
 * the only router in `routes/index.js` outside `publicSharedRoutes` that never
 * touched `userAuth`. Every handler then dereferenced `req.user`, so the
 * omission surfaced as a blanket 500 rather than as anonymous access, and the
 * client's `.catch(() => ({ data: [] }))` in `reportApi` hid even that.
 *
 * The three guards are ordered deliberately, so a caller learns the most
 * general reason they were refused first:
 *
 *   userAuth             → 401, no verified session
 *   requireOrgMembership → 403, session but no organization to scope against
 *   requirePermission    → 403, organization but insufficient role
 *
 * `reports:view` gates the whole router rather than only the read routes.
 * `PERMISSIONS.reports` deliberately excludes `viewer` and `guest` ("reports
 * contain sensitive analytics"), and a role that may not read a report has no
 * business authoring the template that produces one. Ownership of an individual
 * template is a separate question and stays where it already lives, in the
 * controller's creator checks.
 */
router.use(userAuth);
router.use(requireOrgMembership);
router.use(requirePermission("reports", "view"));

router.route("/templates").get(getReportTemplates).post(createReportTemplate);

router
  .route("/templates/:id")
  .get(getReportTemplate)
  .put(updateReportTemplate)
  .delete(deleteReportTemplate);

router.post("/generate/:id", generateReportData);

export default router;
