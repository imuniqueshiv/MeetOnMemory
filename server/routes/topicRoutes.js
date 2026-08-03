import express from "express";
import {
  extractForMeeting,
  getTopicsForMeeting,
  getTopicClusters,
  renameCluster,
  triggerClustering,
} from "../controllers/topicController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(userAuth);

// Meeting specific topic routes
router.post("/extract/:meetingId", extractForMeeting);
router.get("/meeting/:meetingId", getTopicsForMeeting);

// Organization cluster routes
router.get("/clusters/org/:orgId", getTopicClusters);
router.post("/clusters/org/:orgId/cluster", triggerClustering);
router.put("/clusters/:clusterId", renameCluster);

export default router;
