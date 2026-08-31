import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  createBudget,
  listBudgets,
  getBudgetSummary,
} from "../controllers/meetingBudgetController.js";

const router = express.Router();

router.use(userAuth);

router.post("/", createBudget);
router.get("/", listBudgets);
router.get("/:id/summary", getBudgetSummary);

export default router;
