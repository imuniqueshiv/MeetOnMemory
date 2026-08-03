import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  publishTemplate,
  browseTemplates,
  cloneTemplate,
  rateTemplate,
} from "../controllers/templateLibraryController.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(userAuth);

router.post("/", publishTemplate);
router.get("/", browseTemplates);
router.post("/:id/clone", cloneTemplate);
router.post("/:id/rate", rateTemplate);

export default router;
