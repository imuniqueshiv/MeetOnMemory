import express from "express";
import {
  getOrgApiKeys,
  createOrgApiKey,
  revokeOrgApiKey,
  rotateOrgApiKey,
} from "../controllers/apiKeyController.js";
import protect from "../middleware/userAuth.js";

const router = express.Router();

router.use(protect);

router.get("/", getOrgApiKeys);
router.post("/", createOrgApiKey);
router.delete("/:keyId", revokeOrgApiKey);
router.post("/:keyId/rotate", rotateOrgApiKey);

export default router;
