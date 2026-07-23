import Membership from "../models/membershipModel.js";

const POINT_VALUES = {
  meetingsCreated: 10,
  meetingsAttended: 5,
  decisionsContributed: 8,
  actionItemsResolved: 12,
  liveMeetingParticipation: 6,
  policiesUploaded: 15,
};

const recentlyProcessed = new Map();
const DEDUP_WINDOW_MS = 5000;

const isDuplicate = (key) => {
  const now = Date.now();
  const lastProcessed = recentlyProcessed.get(key);
  if (lastProcessed && now - lastProcessed < DEDUP_WINDOW_MS) {
    return true;
  }
  recentlyProcessed.set(key, now);
  return false;
};

const cleanupDedupMap = () => {
  const now = Date.now();
  for (const [key, timestamp] of recentlyProcessed) {
    if (now - timestamp >= DEDUP_WINDOW_MS) {
      recentlyProcessed.delete(key);
    }
  }
};

setInterval(cleanupDedupMap, DEDUP_WINDOW_MS * 2);

export const incrementEngagementScore = async (
  userId,
  organizationId,
  actionType,
  points = null,
) => {
  if (!POINT_VALUES[actionType]) {
    console.warn(`Unknown engagement action type: ${actionType}`);
    return null;
  }

  if (!userId || !organizationId) {
    return null;
  }

  const dedupKey = `${userId}:${organizationId}:${actionType}:${Date.now()}`;
  if (isDuplicate(dedupKey)) {
    return null;
  }

  const awardedPoints = points || POINT_VALUES[actionType];

  try {
    const membership = await Membership.findOneAndUpdate(
      { user: userId, organization: organizationId, status: "active" },
      {
        $inc: {
          engagementScore: awardedPoints,
          [`engagementBreakdown.${actionType}`]: 1,
        },
        $set: { "engagementBreakdown.lastActivityAt": new Date() },
      },
      { new: true },
    );

    return membership;
  } catch (error) {
    console.error(
      `Failed to increment engagement score for user ${userId}:`,
      error.message,
    );
    return null;
  }
};

export const getLeaderboard = async (organizationId, limit = 10) => {
  const leaderboard = await Membership.find({
    organization: organizationId,
    status: "active",
    engagementScore: { $gt: 0 },
  })
    .populate("user", "name email profilePic")
    .sort({ engagementScore: -1 })
    .limit(limit)
    .lean();

  return leaderboard.map((entry, index) => ({
    rank: index + 1,
    user: entry.user,
    engagementScore: entry.engagementScore,
    engagementBreakdown: entry.engagementBreakdown,
    lastActivityAt: entry.engagementBreakdown?.lastActivityAt,
  }));
};

export const getMembershipEngagement = async (userId, organizationId) => {
  const membership = await Membership.findOne({
    user: userId,
    organization: organizationId,
    status: "active",
  })
    .populate("user", "name email profilePic")
    .lean();

  if (!membership) return null;

  return {
    user: membership.user,
    engagementScore: membership.engagementScore,
    engagementBreakdown: membership.engagementBreakdown,
  };
};
