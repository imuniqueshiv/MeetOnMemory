import mongoose from "mongoose";
import * as activityService from "../services/activityService.js";
import { parsePagination } from "../utils/pagination.js";

const getOrgId = (req) =>
  (req.user?.organization?._id || req.user?.organization)?.toString();

const getFilters = (query) => {
  const clean = (value, max = 100) =>
    typeof value === "string" ? value.trim().slice(0, max) : undefined;

  return {
    action: clean(query.action),
    actor: clean(query.actor),
    targetType: clean(query.targetType),
    from: clean(query.from, 30),
    to: clean(query.to, 30),
  };
};

export const getActivities = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId || !mongoose.Types.ObjectId.isValid(orgId)) {
      return res
        .status(400)
        .json({ error: "Valid organization ID is required." });
    }

    const { page, limit } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const result = await activityService.getOrgActivities(orgId, {
      page,
      limit,
      ...getFilters(req.query),
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in getActivities:", error);
    res.status(500).json({ error: "Failed to retrieve activities." });
  }
};

export const exportActivities = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId || !mongoose.Types.ObjectId.isValid(orgId)) {
      return res
        .status(400)
        .json({ error: "Valid organization ID is required." });
    }

    const activities = await activityService.exportOrgActivities(orgId, {
      ...getFilters(req.query),
      limit: req.query.limit,
    });

    const escapeCsv = (value) => {
      const text =
        value === null || value === undefined
          ? ""
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };

    const rows = [
      ["Date", "Actor", "Action", "Type", "Target", "Target ID", "Metadata"],
      ...activities.map((activity) => [
        activity.createdAt?.toISOString?.() || activity.createdAt,
        activity.actor?.name || activity.actor?.email || "Unknown",
        activity.action,
        activity.targetType,
        activity.targetTitle || "",
        activity.targetId,
        activity.metadata || {},
      ]),
    ];

    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const filename = `activity-feed-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(`\uFEFF${csv}`);
  } catch (error) {
    console.error("Error exporting activities:", error);
    res.status(500).json({ error: "Failed to export activities." });
  }
};

export const getActivityStats = async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId || !mongoose.Types.ObjectId.isValid(orgId)) {
      return res
        .status(400)
        .json({ error: "Valid organization ID is required." });
    }

    const stats = await activityService.getActivityStats(orgId);
    res.status(200).json(stats);
  } catch (error) {
    console.error("Error in getActivityStats:", error);
    res.status(500).json({ error: "Failed to retrieve activity stats." });
  }
};
