import mongoose from "mongoose";
import Activity from "../models/activityModel.js";

/**
 * Log an activity and emit real-time event.
 */
export const logActivity = async (
  io,
  orgId,
  actorId,
  action,
  targetType,
  targetId,
  targetTitle = "",
  metadata = {},
) => {
  try {
    const activity = new Activity({
      organization: orgId,
      actor: actorId,
      action,
      targetType,
      targetId,
      targetTitle,
      metadata,
    });

    await activity.save();
    await activity.populate("actor", "name avatarUrl email");

    if (io) {
      io.to(`org_${orgId}`).emit("activity:new", activity);
    }

    return activity;
  } catch (error) {
    console.error("Error logging activity:", error);
    return null;
  }
};

const normalizeDate = (value, endOfDay = false) => {
  if (!value || typeof value !== "string") return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  }
  return parsed;
};

const buildActivityQuery = (orgId, filters = {}) => {
  const { action, actor, targetType, from, to } = filters;
  const query = { organization: orgId };

  if (typeof action === "string" && action) query.action = action;
  if (typeof actor === "string" && actor) {
    if (mongoose.Types.ObjectId.isValid(actor)) query.actor = actor;
    else query.actor = new mongoose.Types.ObjectId("000000000000000000000000");
  }
  if (typeof targetType === "string" && targetType) {
    query.targetType = targetType;
  }

  const createdAt = {};
  const fromDate = normalizeDate(from);
  const toDate = normalizeDate(to, true);
  if (fromDate) createdAt.$gte = fromDate;
  if (toDate) createdAt.$lte = toDate;
  if (Object.keys(createdAt).length) query.createdAt = createdAt;

  return query;
};

/**
 * Get paginated activities for an organization.
 */
export const getOrgActivities = async (orgId, filters = {}) => {
  const { page = 1, limit = 20 } = filters;
  const parsedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const skip = (parsedPage - 1) * parsedLimit;
  const query = buildActivityQuery(orgId, filters);

  const [activities, total] = await Promise.all([
    Activity.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate("actor", "name avatarUrl email")
      .lean(),
    Activity.countDocuments(query),
  ]);

  return {
    activities,
    totalPages: Math.ceil(total / parsedLimit),
    currentPage: parsedPage,
    totalActivities: total,
  };
};

/**
 * Get a bounded filtered set for CSV export. The export intentionally caps
 * rows so a very large organization cannot exhaust server memory.
 */
export const exportOrgActivities = async (orgId, filters = {}) => {
  const parsedLimit = Math.min(
    Math.max(1, parseInt(filters.limit, 10) || 5000),
    5000,
  );
  const query = buildActivityQuery(orgId, filters);

  return Activity.find(query)
    .sort({ createdAt: -1 })
    .limit(parsedLimit)
    .populate("actor", "name avatarUrl email")
    .lean();
};

export const getActivityStats = async (orgId) => {
  const stats = await Activity.aggregate([
    { $match: { organization: new mongoose.Types.ObjectId(orgId) } },
    { $group: { _id: "$action", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return stats;
};
