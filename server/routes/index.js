import express from "express";
import authRoutes from "./authRoutes.js";
import organizationRoutes from "./organizationRoutes.js";
import membershipRoutes from "./membershipRoutes.js";
import membershipRequestRoutes from "./membershipRequestRoutes.js";
import invitationRoutes from "./invitationRoutes.js";
import meetingRoutes from "./meetingRoutes.js";
import searchRoutes from "./searchRoutes.js";
import aiRoutes from "./aiRoutes.js";
import policyRoutes from "./policyRoutes.js";
import analyticsRoutes from "./analyticsRoutes.js";
import geminiRoutes from "./geminiRoutes.js";
import userRoutes from "./userRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import knowledgeRoutes from "./knowledgeRoutes.js";
import policyComplianceRoutes from "./policyComplianceRoutes.js";
import sessionRoutes from "./sessionRoutes.js";
import transcriptRoutes from "./transcriptRoutes.js";
import sharedLinkRoutes from "./sharedLinkRoutes.js";

const router = express.Router();

// ==========================================
// ALL PROTECTED ROUTES (CSRF Enforced globally in express.js)
// ==========================================
router.use("/api/auth", authRoutes);
router.use(["/api/organization", "/api/organizations"], organizationRoutes);
router.use("/api/membership", membershipRoutes);
router.use("/api/membership-request", membershipRequestRoutes);
router.use("/api/invitation", invitationRoutes);
router.use("/api/meetings", meetingRoutes);
router.use("/api/search", searchRoutes);
router.use("/api/ai", aiRoutes);
router.use("/api/policies", policyRoutes);
router.use("/api/analytics", analyticsRoutes);
router.use("/api/gemini", geminiRoutes);
router.use("/api/user", userRoutes);
router.use("/api/notifications", notificationRoutes);
router.use("/api/knowledge", knowledgeRoutes);
router.use("/api/compliance", policyComplianceRoutes);
router.use("/api/sessions", sessionRoutes);
router.use("/api/transcripts", transcriptRoutes);
router.use("/api/shared-links", sharedLinkRoutes);

export default router;
