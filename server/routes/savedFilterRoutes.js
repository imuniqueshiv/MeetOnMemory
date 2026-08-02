import express from "express";
import {
  createSavedFilter,
  getSavedFilters,
  updateSavedFilter,
  deleteSavedFilter,
  togglePin,
} from "../controllers/savedFilterController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgMembership } from "../middleware/rbac.js";

const router = express.Router();

router.use(userAuth);
router.use(requireOrgMembership);

router.post("/", createSavedFilter);
router.get("/", getSavedFilters);
router.patch("/:id", updateSavedFilter);
router.delete("/:id", deleteSavedFilter);
router.patch("/:id/pin", togglePin);

export default router;
