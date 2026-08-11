import mongoose from "mongoose";
import Activity from "../models/activityModel.js";

/**
 * Log an activity and emit real-time event.
 * @param {Object} io - Socket.io instance
 * @param {String} orgId - Organization ID
 * @param {String} actorId - User ID who performed the action
 * @param {String} action - Action enum string (e.g., "meeting.created")
 * @param {String} targetType - Type of target entity (e.g., "Meeting")
 * @param {String} targetId - ID of target entity
 * @param {String} targetTitle - Display title of target entity
 * @param {Object} metadata - Optional additional data
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

    // Populate actor details for the real-time feed
    await activity.populate("actor", "name avatarUrl email");

    // Emit real-time event to the organization room
    if (io) {
      io.to(`org_${orgId}`).emit("activity:new", activity);
    }

    return activity;
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw so it doesn't break the main transaction/flow
    return null;
  }
};

/**
 * Get paginated activities for an organization.
 * @param {String} orgId - Organization ID
 * @param {Object} filters - Query parameters (page, limit, action, actor)
 */
export const getOrgActivities = async (orgId, filters = {}) => {
  const { page = 1, limit = 20, action, actor } = filters;
  const skip = (page - 1) * limit;

  const query = { organization: orgId };
  if (typeof action === "string") query.action = action;
  if (typeof actor === "string") query.actor = actor;

  const [activities, total] = await Promise.all([
    Activity.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("actor", "name avatarUrl email")
      .lean(),
    Activity.countDocuments(query),
  ]);

  return {
    activities,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    totalActivities: total,
  };
};

/**
 * Get activity statistics for an organization.
 * @param {String} orgId - Organization ID
 */
export const getActivityStats = async (orgId) => {
  const stats = await Activity.aggregate([
    { $match: { organization: new mongoose.Types.ObjectId(orgId) } },
    { $group: { _id: "$action", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return stats;
};
