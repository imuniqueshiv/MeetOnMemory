import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getTransferInbox,
  acceptTransfer,
  rejectTransfer,
} from "../controllers/meetingOwnershipTransferController.js";

const router = express.Router();

// GET /api/ownership-transfers/inbox
router.get("/inbox", protect, getTransferInbox);

// POST /api/ownership-transfers/:transferId/accept
router.post("/:transferId/accept", protect, acceptTransfer);

// POST /api/ownership-transfers/:transferId/reject
router.post("/:transferId/reject", protect, rejectTransfer);

// Note: initiateTransfer is mounted under /api/meetings to match the resource hierarchy.
// Example: POST /api/meetings/:meetingId/transfers

export default router;
