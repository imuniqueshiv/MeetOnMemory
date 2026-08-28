import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  apiLimiter,
  writeLimiter,
  dataExportLimiter,
} from "../middleware/rateLimiter.js";
import { requirePermission } from "../middleware/rbac.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  getUserData,
  getCurrentUser,
  updateUserProfile,
  requestDataExport,
  getDataExportStatus,
  downloadExport,
  getDashboardPreferences,
  updateDashboardPreferences,
  uploadAvatar,
} from "../controllers/userController.js";

const userRouter = express.Router();

// Apply rate limiting to all routes
userRouter.use(apiLimiter);

const uploadDir = path.resolve("uploads/avatars");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const userId = req.user?._id || req.user?.id || "unknown";
    cb(null, `avatar-${userId}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error("Only images (jpeg, png, gif, webp) are allowed"),
      false,
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const handleMulterUpload = (req, res, next) => {
  upload.single("avatar")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res
          .status(400)
          .json({ success: false, error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
};

userRouter.post(
  "/avatar",
  userAuth,
  writeLimiter,
  requirePermission("settings", "self_edit"),
  handleMulterUpload,
  uploadAvatar,
);

userRouter.get(
  "/data",
  userAuth,
  requirePermission("settings", "self_view"),
  getUserData,
);
userRouter.get("/me", userAuth, getCurrentUser);
userRouter.put(
  "/update",
  userAuth,
  writeLimiter,
  requirePermission("settings", "self_edit"),
  updateUserProfile,
);

userRouter.get("/preferences/dashboard", userAuth, getDashboardPreferences);

userRouter.put(
  "/preferences/dashboard",
  userAuth,
  writeLimiter,
  updateDashboardPreferences,
);

userRouter.get(
  "/data-export-status",
  userAuth,
  requirePermission("settings", "self_view"),
  getDataExportStatus,
);

userRouter.post(
  "/request-data-export",
  userAuth,
  dataExportLimiter,
  requirePermission("settings", "view"),
  requestDataExport,
);
userRouter.get("/download-export/:token", downloadExport);

export default userRouter;
