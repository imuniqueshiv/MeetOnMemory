import express from "express";
import userAuth from "../middleware/userAuth.js";
import { requireAdminOrOwner } from "../middleware/rbac.js";
import { testimonialSubmitLimiter } from "../middleware/rateLimiter.js";
import {
  listApprovedTestimonials,
  listSpotlightTestimonials,
  getTestimonialStats,
  getMyTestimonial,
  createTestimonial,
  updateTestimonial,
  deleteOwnTestimonial,
  listAdminTestimonials,
  updateTestimonialStatus,
  bulkModerateTestimonials,
  updateTestimonialSpotlight,
  adminDeleteTestimonial,
} from "../controllers/testimonialController.js";

const router = express.Router();

// Public
router.get("/", listApprovedTestimonials);
router.get("/spotlight", listSpotlightTestimonials);
router.get("/stats", getTestimonialStats);

// Authenticated user
router.get("/me", userAuth, getMyTestimonial);
router.post("/", userAuth, testimonialSubmitLimiter, createTestimonial);
router.put("/:id", userAuth, testimonialSubmitLimiter, updateTestimonial);
router.delete("/:id", userAuth, deleteOwnTestimonial);

export default router;

export const adminTestimonialRouter = express.Router();

adminTestimonialRouter.use(userAuth, requireAdminOrOwner);
adminTestimonialRouter.get("/", listAdminTestimonials);
adminTestimonialRouter.post("/bulk", bulkModerateTestimonials);
adminTestimonialRouter.patch("/:id/status", updateTestimonialStatus);
adminTestimonialRouter.patch("/:id/spotlight", updateTestimonialSpotlight);
adminTestimonialRouter.delete("/:id", adminDeleteTestimonial);
