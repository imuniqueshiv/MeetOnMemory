import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  uploadAttachment,
  listAttachments,
  downloadAttachment,
  deleteAttachment,
} from "../controllers/attachmentController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgAccess, requirePermission } from "../middleware/rbac.js";
import Meeting from "../models/meetingModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router({ mergeParams: true }); // mergeParams to get meetingId from parent router

const uploadDir = path.join(__dirname, "..", "uploads", "attachments");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
];

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".pptx",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
];

/**
 * Custom multer file filter for enhanced validation
 * Validates both MIME type and file extension before accepting upload
 */
const fileFilter = (req, file, cb) => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Allowed types: PDF, DOCX, PPTX, JPEG, PNG, GIF`,
      ),
      false,
    );
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      new Error(
        `Invalid file extension: ${ext}. Allowed extensions: ${ALLOWED_EXTENSIONS.join(", ")}`,
      ),
      false,
    );
  }

  cb(null, true);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${uniqueSuffix}-${basename}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
});

// All routes require authentication and org access to the meeting
router.use(userAuth);
router.use(requireOrgAccess(Meeting));

// Route: /api/meetings/:meetingId/attachments
//
// Org access is established above. Upload is restricted to roles that may
// mutate attachments; delete stays in the controller so the original uploader
// (including members) can still remove their own file.
router.post(
  "/",
  requirePermission("attachments", "upload"),
  upload.single("file"),
  uploadAttachment,
);
router.get("/", listAttachments);
router.get("/:id/download", downloadAttachment);
router.delete("/:id", deleteAttachment);

export default router;
