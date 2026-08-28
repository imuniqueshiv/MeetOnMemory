import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import {
  createSubmitCareerApplicationHandler,
  createListApplicationsHandler,
  createUpdateApplicationStatusHandler,
  createDownloadResumeHandler,
} from "../controllers/careerApplicationController.js";
import { createCareersApplicationLimiter } from "../middleware/rateLimiter.js";
import userAuth from "../middleware/userAuth.js";
import { requirePermission } from "../middleware/rbac.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "..", "uploads", "careers");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB — aligned with attachment uploads

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const ALLOWED_EXTENSIONS = [".pdf", ".docx"];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (
    !ALLOWED_MIME_TYPES.includes(file.mimetype) ||
    !ALLOWED_EXTENSIONS.includes(ext)
  ) {
    return cb(
      new Error(
        "Invalid resume file. Only PDF and DOCX files up to 10 MB are allowed.",
      ),
      false,
    );
  }
  cb(null, true);
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
});

const handleResumeUpload = (req, res, next) => {
  upload.single("resume")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Resume file is too large. Maximum allowed size is 10 MB.",
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || "Resume upload failed.",
      });
    }
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Resume upload failed.",
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Resume file is required.",
      });
    }
    next();
  });
};

/**
 * @param {object} [options]
 * @param {import("express").RequestHandler} [options.submitLimiter]
 * @returns {import("express").Router}
 */
export const createCareerRoutes = (options = {}) => {
  const router = express.Router();
  const submitLimiter =
    options.submitLimiter ?? createCareersApplicationLimiter();

  router.post(
    "/applications",
    submitLimiter,
    handleResumeUpload,
    createSubmitCareerApplicationHandler(),
  );

  router.get(
    "/admin/applications",
    userAuth,
    requirePermission("admin_panel", "view"),
    createListApplicationsHandler(),
  );

  router.patch(
    "/admin/applications/:id/status",
    userAuth,
    requirePermission("admin_panel", "manage"),
    createUpdateApplicationStatusHandler(),
  );

  router.get(
    "/admin/applications/:id/resume",
    userAuth,
    requirePermission("admin_panel", "view"),
    createDownloadResumeHandler(),
  );

  return router;
};

export default createCareerRoutes();
