import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/okr';

/**
 * OkrService
 * Singleton robust REST wrapper orchestrating goal telemetry.
 */
class OkrService {
    static async getHierarchy() {
        try {
            const response = await axios.get(`${API_BASE_URL}/hierarchy`, {
                withCredentials: true,
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        } catch (error) {
            console.error("[OkrService] Error:", error);
            throw error;
        }
    }

    static async getHealth() {
        try {
            const response = await axios.get(`${API_BASE_URL}/health`, {
                withCredentials: true
            });
            if (response.data && response.data.success) return response.data.data;
            throw new Error("Invalid payload");
        } catch (error) {
            console.error("[OkrService] Health Error:", error);
            throw error;
        }
    }

    static async getTopology() {
        try {
            const response = await axios.get(`${API_BASE_URL}/topology`, {
                withCredentials: true
            });
            if (response.data && response.data.success) return response.data.data;
            throw new Error("Invalid topology payload");
        } catch (error) {
            console.error("[OkrService] Topology Error:", error);
            throw error;
        }
    }
}

export default OkrService;
