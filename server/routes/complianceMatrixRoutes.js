import express from "express";
import {
    getComplianceAuditScores,
    getSecurityThreatVectors,
    getPIIExposureLogs
} from "../controllers/complianceMatrixController.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

/**
 * @route GET /api/compliance/audit
 * @desc Retrieves compliance matrix mapping across enterprise architectures
 * @access Private
 */
router.get("/audit", getComplianceAuditScores);

/**
 * @route GET /api/compliance/threats
 * @desc Extracts simulated ML endpoints charting vulnerability nodes
 * @access Private
 */
router.get("/threats", getSecurityThreatVectors);

/**
 * @route GET /api/compliance/pii
 * @desc Get flagged PII leaks aggregated from transcript datasets
 * @access Private
 */
router.get("/pii", getPIIExposureLogs);

export default router;
