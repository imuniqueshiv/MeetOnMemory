import NotionIntegrationConfig from "../models/NotionIntegrationConfig.js";

export const notionAuthGuard = async (req, res, next) => {
  try {
    const { orgId } = req.params; // Assume orgId is passed in params or derived from user session
    const targetOrgId = orgId || req.user?.organization;

    if (!targetOrgId) {
      return res.status(400).json({ success: false, message: "Organization ID is missing." });
    }

    const config = await NotionIntegrationConfig.findOne({ organizationId: targetOrgId });

    if (!config || !config.encryptedAccessToken) {
      return res.status(403).json({
        success: false,
        message: "Notion integration is not configured for this organization.",
      });
    }

    req.notionConfig = config;
    next();
  } catch (error) {
    console.error("Notion auth guard error:", error);
    res.status(500).json({ success: false, message: "Internal server error during Notion check." });
  }
};
