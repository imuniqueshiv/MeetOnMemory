import express from "express";
import {
  getPhysicalResources,
  createPhysicalResource,
  getAvailableResources,
  createBooking,
  cancelBooking,
  getMeetingBookings,
} from "../controllers/resourceBookingController.js";
import protect from "../middleware/userAuth.js";

const router = express.Router();

router.use(protect);

router.get("/organization/:organizationId", getPhysicalResources);
router.post("/organization/:organizationId", createPhysicalResource);
router.get("/organization/:organizationId/available", getAvailableResources);
router.post("/organization/:organizationId/bookings", createBooking);
router.delete("/bookings/:bookingId", cancelBooking);
router.get("/meetings/:meetingId/bookings", getMeetingBookings);

export default router;
