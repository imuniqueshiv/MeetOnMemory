import express from "express";
import {
  generateAgenda,
  updateSuggestionItem,
  applyAgenda,
  getSuggestionsByMeeting,
} from "../controllers/agendaSuggestionController.js";
import userAuth from "../middleware/userAuth.js";
import {
  requireOrgMembership,
  requirePermission,
} from "../middleware/rbac.js";

const router = express.Router();

// Require authentication and organization membership for all agenda routes.
router.use(userAuth);
router.use(requireOrgMembership);

// Generating, updating, and applying suggestions mutate meeting agenda data.
router.post("/generate", requirePermission("meetings", "edit"), generateAgenda);
router.put(
  "/:id/item/:itemId",
  requirePermission("meetings", "edit"),
  updateSuggestionItem,
);
router.post("/:id/apply", requirePermission("meetings", "edit"), applyAgenda);

// Listing suggestions is read-only.
router.get(
  "/meeting/:meetingId",
  requirePermission("meetings", "view"),
  getSuggestionsByMeeting,
);

export default router;
