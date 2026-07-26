import express from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import userAuth from "../middleware/userAuth.js";
import Policy from "../models/policyModel.js";
import {
  requireOwnerOrAdmin,
  requireOrgMembership,
  requireAdmin,
  requirePermission,
  requireOrgAccess,
} from "../middleware/rbac.js";
import {
  uploadPolicy,
  getPolicies,
  downloadPolicy,
  deletePolicy,
  analyzePolicy,
} from "../controllers/policyController.js";

const router = express.Router();
// Apply rate limiting to all routes
router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
      success: false,
      message: "Too many requests, please try again after 15 minutes.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ──────────────────────────────────────────────
// Rate Limiters
// ──────────────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: "Too many upload requests, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: {
    success: false,
    message:
      "Too many re-analysis requests, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  message: {
    success: false,
    message: "Too many download requests, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const deleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: "Too many delete requests, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ──────────────────────────────────────────────
// Multer Config — disk storage with validation
// ──────────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/policies/"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        `Unsupported file type: ${path.extname(file.originalname) || file.mimetype}. Only PDF, DOCX, and TXT files are allowed.`,
      ),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// Multer error handler helper
const handleMulterUpload = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum allowed size is 20 MB.",
        });
      }
      return res.status(400).json({
        success: false,
        message: err.field || err.message || "File upload error.",
      });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// ──────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────

// Protected (read-only)
router.get("/", userAuth, requirePermission("policies", "view"), getPolicies);

// Protected — require authentication & rate limiting (admin only for upload)
router.post(
  "/upload",
  uploadLimiter,
  userAuth,
  requireAdmin,
  requireOrgMembership,
  requirePermission("policies", "create"),
  handleMulterUpload,
  uploadPolicy,
);
router.post(
  "/:id/analyze",
  analyzeLimiter,
  userAuth,
  requireOwnerOrAdmin(Policy),
  requirePermission("policies", "approve"),
  analyzePolicy,
);
router.get(
  "/download/:id",
  downloadLimiter,
  userAuth,
  requireOrgAccess(Policy),
  requirePermission("policies", "view"),
  downloadPolicy,
);
router.delete(
  "/:id",
  deleteLimiter,
  userAuth,
  requireOwnerOrAdmin(Policy),
  requirePermission("policies", "delete"),
  deletePolicy,
);

export default router;
