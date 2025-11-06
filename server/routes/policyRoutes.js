import express from "express";
import multer from "multer";
import {
  uploadPolicy,
  getPolicies,
  downloadPolicy,
  deletePolicy,
} from "../controllers/policyController.js";

const router = express.Router();

// 📂 Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/policies/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage });

// 🛠️ Routes
router.post("/upload", upload.single("file"), uploadPolicy);
router.get("/", getPolicies);
router.get("/download/:id", downloadPolicy);
router.delete("/:id", deletePolicy);

export default router;
