import axios from 'axios';

// Environment variable or fallback for the API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/memory-analytics';

/**
 * Memory Analytics Service
 * 
 * Provides robust methods to communicate with the enterprise analytics backend.
 * Integrates error handling, payload unwrapping, and data formatting.
 */
class MemoryAnalyticsService {
    /**
     * Retrieves the simulated timeline of emotional intelligence metrics over 30 days.
     * @returns {Promise<Array>} Array of timeline structural objects.
     */
    static async getSentimentTimeline() {
        try {
            const response = await axios.get(`${API_BASE_URL}/timeline`, {
                withCredentials: true,
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message || "Failed to parse sentiment timeline payload");
        } catch (error) {
            console.error("[MemoryAnalyticsService] getSentimentTimeline Error:", error);
            throw error;
        }
    }

    /**
     * Scans and aggregates Named Entity Recognition (NER) tags found inside memories.
     * @returns {Promise<Array>} Array of weighted named entities.
     */
    static async getEntityHeatmap() {
        try {
            const response = await axios.get(`${API_BASE_URL}/entities`, {
                withCredentials: true,
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message || "Failed to parse entity heatmap payload");
        } catch (error) {
            console.error("[MemoryAnalyticsService] getEntityHeatmap Error:", error);
            throw error;
        }
    }

    /**
     * Fetches high-level Key Performance Indicators (KPIs) for the Memory Graph Dashboard.
     * @returns {Promise<Object>} Object containing aggregate KPI statistics.
     */
    static async getAnalyticsSummary() {
        try {
            const response = await axios.get(`${API_BASE_URL}/summary`, {
                withCredentials: true,
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data.message || "Failed to parse analytics summary payload");
        } catch (error) {
            console.error("[MemoryAnalyticsService] getAnalyticsSummary Error:", error);
            throw error;
        }
    }
}

export default MemoryAnalyticsService;
