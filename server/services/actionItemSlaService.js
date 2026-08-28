import ActionItem from "../models/actionItemModel.js";
import ActionItemSlaConfig from "../models/actionItemSlaConfigModel.js";
import ActionItemSlaBreach from "../models/actionItemSlaBreachModel.js";
import mongoose from "mongoose";
import eventBus from "./eventBus.js";
import { createNotification } from "./notificationService.js";

class ActionItemSlaService {
  /**
   * Get SLA configuration for an organization
   */
  async getConfig(organizationId) {
    let config = await ActionItemSlaConfig.findOne({
      organization: organizationId,
    });
    if (!config) {
      config = await ActionItemSlaConfig.create({
        organization: organizationId,
      });
    }
    return config;
  }

  /**
   * Update SLA configuration for an organization
   */
  async updateConfig(organizationId, updates) {
    const config = await ActionItemSlaConfig.findOneAndUpdate(
      { organization: organizationId },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return config;
  }

  /**
   * Get all breaches with optional filtering
   */
  async getBreaches(organizationId, filters = {}) {
    const query = { organization: organizationId };
    if (filters.status) query.status = filters.status;
    if (filters.assignee) query.assignee = filters.assignee;

    return await ActionItemSlaBreach.find(query)
      .populate(
        "actionItem",
        "text status priority dueDate createdAt resolvedAt sourceMeetingId",
      )
      .populate("assignee", "name email")
      .populate("acknowledgedBy", "name email")
      .sort({ createdAt: -1 });
  }

  /**
   * Acknowledge a breach
   */
  async acknowledgeBreach(breachId, userId) {
    const breach = await ActionItemSlaBreach.findByIdAndUpdate(
      breachId,
      {
        status: "acknowledged",
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
      { new: true },
    );
    return breach;
  }

  /**
   * Detect SLA breaches for an organization
   */
  async detectBreaches(organizationId) {
    const config = await this.getConfig(organizationId);
    if (!config.enabled) return { newBreaches: 0 };

    const actionItems = await ActionItem.find({
      organization: organizationId,
      status: { $nin: ["cancelled", "superseded"] },
    });

    const now = new Date();
    let newBreachesCount = 0;

    for (const item of actionItems) {
      const targets = config.targets[item.priority] || config.targets.medium;

      // Calculate actual hours since creation
      const hoursSinceCreation = (now - item.createdAt) / (1000 * 60 * 60);

      // 1. Check Response SLA (Time to move out of 'open')
      if (
        item.status === "open" &&
        hoursSinceCreation > targets.targetResponseHours
      ) {
        const recorded = await this._recordBreach(
          item,
          organizationId,
          "response",
          targets.targetResponseHours,
          hoursSinceCreation,
        );
        if (recorded) newBreachesCount++;
      }

      // 2. Check Resolution SLA (Time to move to 'resolved' or 'completed')
      const isResolved = ["resolved", "completed"].includes(item.status);
      let resolutionHours = hoursSinceCreation;
      if (isResolved && item.resolvedAt) {
        resolutionHours = (item.resolvedAt - item.createdAt) / (1000 * 60 * 60);
      } else if (isResolved && item.completedAt) {
        resolutionHours =
          (item.completedAt - item.createdAt) / (1000 * 60 * 60);
      }

      if (
        (!isResolved && hoursSinceCreation > targets.targetResolutionHours) ||
        (isResolved && resolutionHours > targets.targetResolutionHours)
      ) {
        const recorded = await this._recordBreach(
          item,
          organizationId,
          "resolution",
          targets.targetResolutionHours,
          resolutionHours,
        );
        if (recorded) newBreachesCount++;
      }
    }

    return { newBreaches: newBreachesCount };
  }

  /**
   * Detect SLA breaches across all organizations
   */
  async detectAllBreaches() {
    // Get all distinct organizations that have active action items
    const organizationIds = await ActionItem.distinct("organization", {
      status: { $nin: ["cancelled", "superseded"] },
      organization: { $ne: null },
    });

    let totalBreaches = 0;
    for (const orgId of organizationIds) {
      const result = await this.detectBreaches(orgId);
      totalBreaches += result.newBreaches;
    }

    return { totalBreaches };
  }

  async _recordBreach(
    actionItem,
    organizationId,
    breachType,
    targetHours,
    actualHours,
  ) {
    try {
      const breach = await ActionItemSlaBreach.create({
        actionItem: actionItem._id,
        organization: organizationId,
        assignee: actionItem.assignee,
        priority: actionItem.priority,
        breachType,
        targetHours,
        actualHours: Math.round(actualHours * 10) / 10,
      });

      eventBus.emit("sla.breach.detected", {
        organizationId,
        breachId: breach._id,
        actionItemId: actionItem._id,
      });

      return true;
    } catch (error) {
      // Ignore duplicate key errors (11000) as it means breach was already recorded
      if (error.code !== 11000) {
        console.error("Error recording SLA breach:", error);
      }
      return false;
    }
  }

  /**
   * Get SLA compliance statistics
   */
  async getComplianceStats(organizationId) {
    const totalBreaches = await ActionItemSlaBreach.countDocuments({
      organization: organizationId,
    });
    const openBreaches = await ActionItemSlaBreach.countDocuments({
      organization: organizationId,
      status: "open",
    });

    const breachesByAssignee = await ActionItemSlaBreach.aggregate([
      { $match: { organization: new mongoose.Types.ObjectId(organizationId) } },
      { $group: { _id: "$assignee", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    // Populate user info for top assignees
    await ActionItemSlaBreach.populate(breachesByAssignee, {
      path: "_id",
      model: "User",
      select: "name email",
    });

    return {
      totalBreaches,
      openBreaches,
      breachesByAssignee: breachesByAssignee.map((b) => ({
        assignee: b._id,
        count: b.count,
      })),
    };
  }

  /**
   * Notify breach assignee
   */
  async notifyAssignee(breachId) {
    const breach = await ActionItemSlaBreach.findById(breachId)
      .populate("actionItem")
      .populate("assignee");

    if (!breach) {
      throw new Error("Breach not found");
    }

    if (!breach.assignee) {
      throw new Error("No assignee assigned to this task");
    }

    const title = "SLA Compliance Breach Alert";
    const description = `The task "${breach.actionItem.text}" has breached its SLA of ${breach.targetHours} hours (actual: ${Math.round(breach.actualHours)} hours).`;
    const category = "tasks";
    const actionUrl = `/followup/tasks/${breach.actionItem._id}`;
    const actionLabel = "View Task";

    await createNotification(
      breach.assignee._id || breach.assignee,
      title,
      description,
      category,
      actionUrl,
      actionLabel,
      { breachId: breach._id, actionItemId: breach.actionItem._id },
    );

    return breach;
  }
}

export default new ActionItemSlaService();
