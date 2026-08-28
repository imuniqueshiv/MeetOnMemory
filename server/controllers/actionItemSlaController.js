import actionItemSlaService from "../services/actionItemSlaService.js";

class ActionItemSlaController {
  async getConfig(req, res) {
    try {
      const { organizationId } = req.params;
      const config = await actionItemSlaService.getConfig(organizationId);
      res.json(config);
    } catch (error) {
      console.error("Error fetching SLA config:", error);
      res.status(500).json({ error: "Failed to fetch SLA config" });
    }
  }

  async updateConfig(req, res) {
    try {
      const { organizationId } = req.params;
      const updates = req.body;
      const config = await actionItemSlaService.updateConfig(
        organizationId,
        updates,
      );
      res.json(config);
    } catch (error) {
      console.error("Error updating SLA config:", error);
      res.status(500).json({ error: "Failed to update SLA config" });
    }
  }

  async getBreaches(req, res) {
    try {
      const { organizationId } = req.params;
      const filters = req.query; // e.g., status, assignee
      const breaches = await actionItemSlaService.getBreaches(
        organizationId,
        filters,
      );
      res.json(breaches);
    } catch (error) {
      console.error("Error fetching SLA breaches:", error);
      res.status(500).json({ error: "Failed to fetch SLA breaches" });
    }
  }

  async acknowledgeBreach(req, res) {
    try {
      const { breachId } = req.params;
      const userId = req.user._id;
      const breach = await actionItemSlaService.acknowledgeBreach(
        breachId,
        userId,
      );
      res.json(breach);
    } catch (error) {
      console.error("Error acknowledging SLA breach:", error);
      res.status(500).json({ error: "Failed to acknowledge SLA breach" });
    }
  }

  async getComplianceStats(req, res) {
    try {
      const { organizationId } = req.params;
      const stats =
        await actionItemSlaService.getComplianceStats(organizationId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching SLA compliance stats:", error);
      res.status(500).json({ error: "Failed to fetch SLA compliance stats" });
    }
  }

  async notifyBreach(req, res) {
    try {
      const { breachId } = req.params;
      const breach = await actionItemSlaService.notifyAssignee(breachId);
      res.json({ success: true, message: "Assignee notified", breach });
    } catch (error) {
      console.error("Error notifying SLA breach:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to notify assignee" });
    }
  }
}

export default new ActionItemSlaController();
