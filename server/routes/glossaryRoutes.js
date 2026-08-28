import express from "express";
import * as glossaryController from "../controllers/glossaryController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership, requirePermission } from "../middleware/rbac.js";

const router = express.Router();

/**
 * Glossary routes (Issue #1273).
 *
 * The router previously applied `userAuth` and nothing else, so a `viewer` or
 * `guest` could create, edit, approve and delete organization-wide glossary
 * terms. The `viewer` role added in #1117 is explicitly meant to be read-only.
 *
 * Permissions map onto the existing `knowledge` resource rather than a new
 * `glossary` one. The glossary *is* organization knowledge, its role sets are
 * already the ones wanted here, and `PERMISSIONS` is mirrored in
 * `client/src/utils/rbacPermissions.js` — introducing a resource on the server
 * alone would let the two drift, and updating both is a wider change than this
 * fix warrants.
 *
 * `detect` is a read: it takes text the caller already has on screen and
 * annotates it against approved terms. `extract` writes pending suggestions and
 * consumes an AI call, so it is gated as a create.
 */
router.use(userAuth);
router.use(requireOrgMembership);

router.get(
  "/",
  requirePermission("knowledge", "view"),
  glossaryController.getTerms,
);
router.post(
  "/",
  requirePermission("knowledge", "create"),
  glossaryController.createTerm,
);
router.put(
  "/:id",
  requirePermission("knowledge", "edit"),
  glossaryController.updateTerm,
);
router.delete(
  "/:id",
  requirePermission("knowledge", "delete"),
  glossaryController.deleteTerm,
);

// Approval for pending terms (#2245)
router.post(
  "/:id/approve",
  requirePermission("knowledge", "edit"),
  glossaryController.approveTerm,
);
router.post(
  "/:id/reject",
  requirePermission("knowledge", "edit"),
  glossaryController.rejectTerm,
);

// Detection endpoint
router.post(
  "/detect",
  requirePermission("knowledge", "view"),
  glossaryController.detect,
);

// Extraction endpoint
router.post(
  "/extract",
  requirePermission("knowledge", "create"),
  glossaryController.extract,
);

export default router;
