import express from "express";
import * as glossaryController from "../controllers/glossaryController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

router.use(userAuth);

router.get("/", glossaryController.getTerms);
router.post("/", glossaryController.createTerm);
router.put("/:id", glossaryController.updateTerm);
router.delete("/:id", glossaryController.deleteTerm);

// Approval for pending terms
router.post("/:id/approve", glossaryController.approveTerm);

// Detection endpoint
router.post("/detect", glossaryController.detect);

// Extraction endpoint
router.post("/extract", glossaryController.extract);

export default router;
