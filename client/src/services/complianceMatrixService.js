import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/compliance';

/**
 * ComplianceMatrixService
 * Telemetry endpoint wrapper for enterprise AI vulnerability extraction.
 */
class ComplianceMatrixService {
    static async getAuditScores() {
        try {
            const res = await axios.get(`${API_BASE_URL}/audit`, { withCredentials: true });
            if (res.data?.success) return res.data.data;
            throw new Error("Invalid audit structure");
        } catch (e) {
            console.error("[Compliance] Audit Fault:", e);
            throw e;
        }
    }

    static async getThreatVectors() {
        try {
            const res = await axios.get(`${API_BASE_URL}/threats`, { withCredentials: true });
            if (res.data?.success) return res.data.data;
            throw new Error("Invalid vector map");
        } catch (e) {
            console.error("[Compliance] Threat Fetch Error:", e);
            throw e;
        }
    }

    static async getPIILogs() {
        try {
            const res = await axios.get(`${API_BASE_URL}/pii`, { withCredentials: true });
            if (res.data?.success) return res.data.data;
            throw new Error("Invalid PII telemetry chunk");
        } catch (e) {
            console.error("[Compliance] PII Extraction Error:", e);
            throw e;
        }
    }
}

export default ComplianceMatrixService;
