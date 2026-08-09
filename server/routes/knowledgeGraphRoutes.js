import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  getOrganizationGraph,
  getMeetingGraph,
  getEntity,
  findPathEndpoint,
  getAnalytics,
  exportGraph,
  search,
} from "../controllers/knowledgeGraphController.js";

const router = express.Router();

// Apply authentication to all routes
router.use(userAuth);

// Organization graph
router.get("/organization/:orgId", getOrganizationGraph);
router.get("/analytics/:orgId", getAnalytics);

// Meeting graph
router.get("/meeting/:meetingId", getMeetingGraph);

// Entity operations
router.get("/entity/:type/:id", getEntity);
router.get("/path", findPathEndpoint);
router.get("/search", search);

// Export
router.post("/export", exportGraph);

export default router;
