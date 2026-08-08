import express from "express";
import {
  extractForMeeting,
  getTopicsForMeeting,
  getTopicClusters,
  renameCluster,
  triggerClustering,
} from "../controllers/topicController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership } from "../middleware/rbac.js";

const router = express.Router();

/**
 * Topic routes (Issue #1276).
 *
 * `requireOrgMembership` is what makes the handlers' scoping meaningful. Every
 * one of them filters on `req.user.organization`; a caller without one reached
 * them with `undefined`, and Mongoose reads `{ organization: undefined }` as
 * "match documents where the field is unset" rather than as an error — so the
 * filter that looks like a tenant boundary silently stopped being one.
 */
router.use(userAuth);
router.use(requireOrgMembership);

// Meeting specific topic routes
router.post("/extract/:meetingId", extractForMeeting);
router.get("/meeting/:meetingId", getTopicsForMeeting);

// Organization cluster routes.
//
// `:orgId` is kept rather than removed — `client/src/pages/TopicExplorer.jsx`
// calls the parameterised URL — but the handlers now reject a value that does
// not match the caller's own organization instead of ignoring it and returning
// the caller's data under someone else's id.
router.get("/clusters/org/:orgId", getTopicClusters);
router.post("/clusters/org/:orgId/cluster", triggerClustering);
router.put("/clusters/:clusterId", renameCluster);

export default router;
