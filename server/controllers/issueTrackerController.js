import IssueTrackerIntegration from "../models/issueTrackerIntegrationModel.js";

/**
 * Get current issue tracker integration configuration
 */
export const getConfig = async (req, res) => {
  try {
    const { provider } = req.params;
    const orgId = req.user.organization;

    if (!["jira", "linear"].includes(provider)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid provider" });
    }

    const integration = await IssueTrackerIntegration.findOne({
      organization: orgId,
      provider,
    });

    if (!integration) {
      return res.status(200).json({ success: true, data: null });
    }

    // Don't send tokens back to the client
    const {
      accessToken: _accessToken,
      refreshToken: _refreshToken,
      webhookSecret: _webhookSecret,
      ...safeData
    } = integration.toObject();

    res.status(200).json({ success: true, data: safeData });
  } catch (error) {
    console.error("Error getting issue tracker config:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

/**
 * Update or create an issue tracker configuration
 */
export const updateConfig = async (req, res) => {
  try {
    const { provider } = req.params;
    const orgId = req.user.organization;
    const userId = req.user.id;
    const { accessToken, config } = req.body;

    if (!["jira", "linear"].includes(provider)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid provider" });
    }

    if (!accessToken && !config) {
      return res.status(400).json({ success: false, error: "Missing payload" });
    }

    let integration = await IssueTrackerIntegration.findOne({
      organization: orgId,
      provider,
    });

    if (config?.siteUrl && provider === "jira") {
      try {
        const parsed = new URL(config.siteUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid site URL protocol" });
        }
      } catch (_e) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid site URL format" });
      }
    }

    const logEntry = {
      timestamp: new Date(),
      action: integration ? "config_update" : "connected",
      status: "success",
      details: `Saved ${provider} configuration & field mappings`,
    };

    if (integration) {
      if (accessToken) integration.accessToken = accessToken;
      if (config) integration.config = { ...integration.config, ...config };
      integration.connectedBy = userId;
      integration.lastSyncStatus = "idle";
      integration.syncLogs = [logEntry, ...(integration.syncLogs || [])].slice(
        0,
        15,
      );
      await integration.save();
    } else {
      if (!accessToken) {
        return res.status(400).json({
          success: false,
          error: "Access token is required for initial connection",
        });
      }
      integration = await IssueTrackerIntegration.create({
        organization: orgId,
        provider,
        accessToken,
        config: config || {},
        connectedBy: userId,
        lastSyncStatus: "idle",
        syncLogs: [logEntry],
      });
    }

    const {
      accessToken: _,
      refreshToken: __,
      webhookSecret: ___,
      ...safeData
    } = integration.toObject();
    res.status(200).json({ success: true, data: safeData });
  } catch (error) {
    console.error("Error updating issue tracker config:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

/**
 * Get issue tracker sync status & history logs
 */
export const getSyncStatus = async (req, res) => {
  try {
    const { provider } = req.params;
    const orgId = req.user.organization;

    if (!["jira", "linear"].includes(provider)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid provider" });
    }

    const integration = await IssueTrackerIntegration.findOne({
      organization: orgId,
      provider,
    });

    if (!integration) {
      return res.status(200).json({
        success: true,
        data: {
          connected: false,
          lastSyncAt: null,
          lastSyncStatus: "idle",
          lastSyncError: null,
          syncCount: 0,
          syncLogs: [],
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        connected: true,
        lastSyncAt: integration.lastSyncAt,
        lastSyncStatus: integration.lastSyncStatus,
        lastSyncError: integration.lastSyncError,
        syncCount: integration.syncCount || 0,
        syncLogs: integration.syncLogs || [],
      },
    });
  } catch (error) {
    console.error("Error getting issue tracker sync status:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

/**
 * Disconnect an issue tracker integration
 */
export const disconnect = async (req, res) => {
  try {
    const { provider } = req.params;
    const orgId = req.user.organization;

    if (!["jira", "linear"].includes(provider)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid provider" });
    }

    await IssueTrackerIntegration.findOneAndDelete({
      organization: orgId,
      provider,
    });

    res
      .status(200)
      .json({ success: true, message: "Disconnected successfully" });
  } catch (error) {
    console.error("Error disconnecting issue tracker:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};
