import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/cost-engine';

/**
 * MeetingCostService
 * Coordinates extraction of algorithmic meeting spend data blocks.
 */
class MeetingCostService {
    static async getAggregations() {
        try {
            const response = await axios.get(`${API_BASE_URL}/aggregations`, { withCredentials: true });
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error("Unable to unwrap valid aggregation response chunk.");
        } catch (e) {
            console.error("[MeetingCostService] Error:", e);
            throw e;
        }
    }

    static async getTopography() {
        try {
            const response = await axios.get(`${API_BASE_URL}/topography`, { withCredentials: true });
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error("Topography extraction failed");
        } catch (e) {
            console.error("[MeetingCostService] Error:", e);
            throw e;
        }
    }

    static async getInsights() {
        try {
            const response = await axios.get(`${API_BASE_URL}/insights`, { withCredentials: true });
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error("AI Insights Extraction fault block");
        } catch (e) {
            console.error("[MeetingCostService] Error:", e);
            throw e;
        }
    }
}

export default MeetingCostService;
