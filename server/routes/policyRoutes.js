import express from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import userAuth from "../middleware/userAuth.js";
import Policy from "../models/policyModel.js";
import {
  requireOwnerOrAdmin,
  requireOrgMembership,
  requireAdminOrOwner,
  requirePermission,
  requireOrgAccess,
} from "../middleware/rbac.js";
import {
  uploadPolicy,
  getPolicies,
  downloadPolicy,
  deletePolicy,
  analyzePolicy,
  comparePolicyVersions,
} from "../controllers/policyController.js";
import {
  policyApiLimiter,
  policyUploadLimiter,
  policyAnalyzeLimiter,
  policyDownloadLimiter,
  policyDeleteLimiter,
} from "../middleware/rateLimiter.js";

const router = express.Router();
// Apply rate limiting to all routes
router.use(policyApiLimiter);

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
  policyUploadLimiter,
  userAuth,
  requireAdminOrOwner,
  requireOrgMembership,
  requirePermission("policies", "create"),
  handleMulterUpload,
  uploadPolicy,
);
router.post(
  "/:id/analyze",
  policyAnalyzeLimiter,
  userAuth,
  requireOwnerOrAdmin(Policy),
  requirePermission("policies", "approve"),
  analyzePolicy,
);
router.get(
  "/download/:id",
  policyDownloadLimiter,
  userAuth,
  requireOrgAccess(Policy),
  requirePermission("policies", "view"),
  downloadPolicy,
);
router.get(
  "/:id/diff",
  userAuth,
  requireOrgAccess(Policy),
  requirePermission("policies", "view"),
  comparePolicyVersions,
);
router.delete(
  "/:id",
  policyDeleteLimiter,
  userAuth,
  requireOwnerOrAdmin(Policy),
  requirePermission("policies", "delete"),
  deletePolicy,
);

export default router;
