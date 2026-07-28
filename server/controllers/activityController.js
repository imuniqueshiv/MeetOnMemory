import * as activityService from "../services/activityService.js";

/**
 * Get activities for the user's current organization
 * GET /api/activities
 */
export const getActivities = async (req, res) => {
  try {
    const orgId = req.user.currentOrganization;
    if (!orgId) {
      return res.status(400).json({ error: "No organization selected." });
    }

    const { page, limit, action, actor } = req.query;

    const result = await activityService.getOrgActivities(orgId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      action,
      actor,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in getActivities:", error);
    res.status(500).json({ error: "Failed to retrieve activities." });
  }
};

/**
 * Get activity statistics for the user's current organization
 * GET /api/activities/stats
 */
export const getActivityStats = async (req, res) => {
  try {
    const orgId = req.user.currentOrganization;
    if (!orgId) {
      return res.status(400).json({ error: "No organization selected." });
    }

    const stats = await activityService.getActivityStats(orgId);

    res.status(200).json(stats);
  } catch (error) {
    console.error("Error in getActivityStats:", error);
    res.status(500).json({ error: "Failed to retrieve activity stats." });
  }
};
