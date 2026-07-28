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
import { requireOrgAccess } from "../middleware/rbac.js";
import Meeting from "../models/meetingModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router({ mergeParams: true }); // mergeParams to get meetingId from parent router

const uploadDir = path.join(__dirname, "..", "uploads", "attachments");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// All routes require org access to the meeting
router.use(requireOrgAccess(Meeting));

// Route: /api/meetings/:meetingId/attachments
router.post("/", upload.single("file"), uploadAttachment);
router.get("/", listAttachments);
router.get("/:id/download", downloadAttachment);
router.delete("/:id", deleteAttachment);

export default router;
