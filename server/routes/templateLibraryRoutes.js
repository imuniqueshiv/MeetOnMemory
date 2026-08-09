import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership } from "../middleware/rbac.js";
import {
  publishTemplate,
  browseTemplates,
  cloneTemplate,
  rateTemplate,
} from "../controllers/templateLibraryController.js";

const router = express.Router();

// Apply auth middleware to all routes.
//
// Every handler scopes its queries with `req.user.organization`. A caller
// without one previously reached the handlers with `organizationId: undefined`,
// which Mongoose treats as "match documents where the field is unset" rather
// than as an error — so the filter that looks like a tenant boundary silently
// stopped being one (Issue #1275).
router.use(userAuth);
router.use(requireOrgMembership);

router.post("/", publishTemplate);
router.get("/", browseTemplates);
router.post("/:id/clone", cloneTemplate);
router.post("/:id/rate", rateTemplate);

export default router;
