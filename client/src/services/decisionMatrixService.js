import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/decision-matrix';

/**
 * DecisionMatrixService
 * Maps standard REST calls to robust front-end telemetry states
 */
class DecisionMatrixService {
    static async getTopology() {
        try {
            const resp = await axios.get(`${API_BASE_URL}/topology`, { withCredentials: true });
            if (resp.data?.success) return resp.data.data;
            throw new Error(resp.data?.message || "Invalid payload");
        } catch (error) {
            console.error("[DecisionMatrix] Error fetching topology:", error);
            throw error;
        }
    }

    static async getMetrics() {
        try {
            const resp = await axios.get(`${API_BASE_URL}/metrics`, { withCredentials: true });
            if (resp.data?.success) return resp.data.data;
            throw new Error("Invalid metrics payload");
        } catch (error) {
            console.error("[DecisionMatrix] Error fetching metrics:", error);
            throw error;
        }
    }

    static async getRisks() {
        try {
            const resp = await axios.get(`${API_BASE_URL}/risks`, { withCredentials: true });
            if (resp.data?.success) return resp.data.data;
            throw new Error("Invalid risks payload");
        } catch (error) {
            console.error("[DecisionMatrix] Error fetching risks:", error);
            throw error;
        }
    }
}

export default DecisionMatrixService;
