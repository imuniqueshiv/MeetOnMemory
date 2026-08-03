import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  upsertSchedule,
  getSchedule,
  getDeliveryHistory,
  retryDelivery,
} from "../controllers/recapScheduleController.js";

const router = express.Router();

// All routes require authentication
router.use(userAuth);

// Get schedule for an organization
router.get("/:organizationId", getSchedule);

// Create or update schedule for an organization
router.put("/:organizationId", upsertSchedule);

// Get delivery history (per user)
router.get("/history/deliveries", getDeliveryHistory);

// Retry a delivery
router.post("/retry/:deliveryId", retryDelivery);

export default router;
