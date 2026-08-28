import apiClient from "./apiClient";
import { getBackendUrl } from "../config/backendConfig.js";

/**
 * Client API service for Slack Integration (#2007)
 */
export const slackApi = {
  /**
   * Fetch Slack connection status for an organization
   */
  getStatus: async (organizationId) => {
    const response = await apiClient.get("/api/slack/status", {
      params: organizationId ? { organizationId } : {},
    });
    return response.data;
  },

  /**
   * Disconnect Slack integration for an organization
   */
  disconnect: async (organizationId) => {
    const response = await apiClient.post("/api/slack/disconnect", {
      organizationId,
    });
    return response.data;
  },

  /**
   * Update default notification channel
   */
  updateChannel: async (organizationId, channelId) => {
    const response = await apiClient.patch("/api/slack/channel", {
      organizationId,
      channelId,
    });
    return response.data;
  },

  /**
   * Get install redirect URL
   */
  getInstallUrl: (organizationId) => {
    const backendUrl = getBackendUrl();
    const params = new URLSearchParams();
    if (organizationId) {
      params.append("organizationId", organizationId);
    }
    return `${backendUrl}/api/slack/install${
      params.toString() ? `?${params.toString()}` : ""
    }`;
  },
};

export default slackApi;
