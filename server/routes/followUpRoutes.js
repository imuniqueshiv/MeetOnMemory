import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  getTasks,
  getTask,
  updateStatus,
  acknowledgeTask,
  getReminders,
  updateReminderPreferences,
  getAnalytics,
  escalateTask,
  processRemindersManually,
} from "../controllers/followUpController.js";

const router = express.Router();

// Apply authentication to all routes
router.use(userAuth);

// Task management
router.get("/tasks", getTasks);
router.get("/tasks/:id", getTask);
router.patch("/tasks/:id/status", updateStatus);
router.post("/tasks/:id/acknowledge", acknowledgeTask);

// Reminders
router.get("/reminders", getReminders);
router.put("/reminders", updateReminderPreferences);

// Analytics
router.get("/analytics", getAnalytics);

// Admin operations
router.post("/escalate/:id", escalateTask);
router.post("/process-reminders", processRemindersManually);

export default router;
