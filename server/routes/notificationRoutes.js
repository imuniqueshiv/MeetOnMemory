// server/routes/notificationRoutes.js
import express from "express";
import userAuth from "../middleware/userAuth.js";
import { apiLimiter, writeLimiter } from "../middleware/rateLimiter.js";
import { requirePermission } from "../middleware/rbac.js";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  getPreferences,
  updatePreferences,
} from "../controllers/notificationController.js";

const notificationRouter = express.Router();

notificationRouter.use(userAuth, apiLimiter);

notificationRouter.get(
  "/",
  requirePermission("notifications", "view"),
  getNotifications,
);
notificationRouter.get(
  "/unread-count",
  requirePermission("notifications", "view"),
  getUnreadCount,
);
notificationRouter.patch(
  "/mark-all-read",
  writeLimiter,
  requirePermission("notifications", "manage"),
  markAllAsRead,
);
notificationRouter.patch(
  "/:id/read",
  writeLimiter,
  requirePermission("notifications", "view"),
  markAsRead,
);
notificationRouter.get(
  "/preferences",
  requirePermission("notifications", "view"),
  getPreferences,
);
notificationRouter.put(
  "/preferences",
  writeLimiter,
  requirePermission("notifications", "manage"),
  updatePreferences,
);

notificationRouter.delete(
  "/:id",
  writeLimiter,
  requirePermission("notifications", "manage"),
  deleteNotification,
);

export default notificationRouter;
