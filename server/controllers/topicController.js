import mongoose from "mongoose";
import { z } from "zod";
import * as topicExtractionService from "../services/topicExtractionService.js";
import MeetingTopic from "../models/meetingTopicModel.js";
import TopicCluster from "../models/topicClusterModel.js";
import Meeting from "../models/meetingModel.js";
import { canAccessMeetingDoc } from "../middleware/rbac.js";
import { AppError } from "../utils/errors.js";

/** Cluster labels appear in chart axes and legends; long ones break the view. */
const MAX_CLUSTER_LABEL_LENGTH = 120;

const renameClusterSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Label is required")
    .max(
      MAX_CLUSTER_LABEL_LENGTH,
      `Label cannot exceed ${MAX_CLUSTER_LABEL_LENGTH} characters`,
    ),
});

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Maps an `AppError` from the service onto its own status.
 *
 * Every handler here caught everything and answered 500, so a cross-organization
 * extraction attempt was indistinguishable from a server fault — both to the
 * caller and in the logs (Issue #1276).
 *
 * Returns true when it has responded.
 */
const sendAppError = (res, error) => {
  if (!(error instanceof AppError)) return false;

  res.status(error.statusCode).json({ success: false, error: error.message });
  return true;
};

export const extractForMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const orgId = req.user.organization;

    if (!isValidId(meetingId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid meeting ID" });
    }

    const result = await topicExtractionService.extractTopics(meetingId, orgId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (sendAppError(res, error)) return;

    console.error("Error extracting topics:", error);
    res
      .status(500)
      .json({ success: false, error: "An internal server error occurred" });
  }
};

export const getTopicsForMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!isValidId(meetingId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid meeting ID" });
    }

    // Authorize against the meeting before reading its topics (Issue #1276).
    //
    // This handler never consulted `req.user` at all. `MeetingTopic.findOne({
    // meeting: meetingId })` returned the AI-extracted topic names, keywords
    // and discussion time ranges for *any* meeting in the database, and
    // `.populate("topics.clusterId")` pulled the owning organization's cluster
    // labels and descriptions along with them — a summary of what was said in
    // a private meeting, readable by id.
    //
    // `canAccessMeetingDoc` is the predicate `requireOrgAccess` uses, so this
    // is the same rule the rest of the meeting surface applies, not a second
    // definition of it.
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, error: "Meeting not found" });
    }
    if (!canAccessMeetingDoc(meeting, req.user)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: You don't have access to this meeting",
      });
    }

    const meetingTopic = await MeetingTopic.findOne({
      meeting: meetingId,
    }).populate("topics.clusterId");
    res
      .status(200)
      .json({ success: true, data: meetingTopic ? meetingTopic.topics : [] });
  } catch (error) {
    console.error("Error getting topics for meeting:", error);
    res
      .status(500)
      .json({ success: false, error: "An internal server error occurred" });
  }
};

/**
 * Rejects a `:orgId` path parameter that names an organization other than the
 * caller's.
 *
 * The two cluster routes declare `:orgId`, and both handlers ignored it and
 * used `req.user.organization` instead. Passing another organization's id
 * therefore returned 200 with *your own* clusters — quietly misleading rather
 * than an explicit refusal, and an invitation to assume the parameter is what
 * scopes the query.
 *
 * The parameter is validated rather than removed because
 * `client/src/pages/TopicExplorer.jsx` calls the parameterised URL; dropping it
 * would break that page. Validating is strictly stronger than ignoring.
 *
 * Returns true when it has responded.
 */
const rejectMismatchedOrgParam = (req, res) => {
  const { orgId } = req.params;
  if (!orgId) return false;

  if (orgId !== req.user.organization.toString()) {
    res.status(403).json({
      success: false,
      error: "Forbidden: organization does not match your membership",
    });
    return true;
  }

  return false;
};

export const getTopicClusters = async (req, res) => {
  try {
    if (rejectMismatchedOrgParam(req, res)) return;

    const orgId = req.user.organization;
    const clusters = await TopicCluster.find({ organization: orgId }).sort({
      meetingCount: -1,
    });
    res.status(200).json({ success: true, data: clusters });
  } catch (error) {
    console.error("Error getting topic clusters:", error);
    res
      .status(500)
      .json({ success: false, error: "An internal server error occurred" });
  }
};

export const renameCluster = async (req, res) => {
  try {
    const { clusterId } = req.params;

    if (!isValidId(clusterId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid cluster ID" });
    }

    const parsed = renameClusterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || "Validation error",
      });
    }

    const { label } = parsed.data;

    // Scope the lookup (Issue #1276).
    //
    // This was `TopicCluster.findById(clusterId)`. `TopicCluster` has a
    // required, indexed `organization` field that the handler never used, so
    // any authenticated user could rewrite the label on another organization's
    // cluster — and `isUserRenamed = true` then stopped the clustering job from
    // ever correcting it. The label is what that organization's topic dashboard
    // displays.
    const cluster = await TopicCluster.findOne({
      _id: clusterId,
      organization: req.user.organization,
    });

    if (!cluster) {
      return res
        .status(404)
        .json({ success: false, error: "Cluster not found" });
    }

    cluster.label = label.trim();
    cluster.isUserRenamed = true;
    await cluster.save();

    res.status(200).json({ success: true, data: cluster });
  } catch (error) {
    console.error("Error renaming cluster:", error);
    res
      .status(500)
      .json({ success: false, error: "An internal server error occurred" });
  }
};

export const triggerClustering = async (req, res) => {
  try {
    if (rejectMismatchedOrgParam(req, res)) return;

    const orgId = req.user.organization;
    const clusters = await topicExtractionService.clusterTopics(orgId);
    res.status(200).json({ success: true, data: clusters });
  } catch (error) {
    console.error("Error clustering topics:", error);
    res
      .status(500)
      .json({ success: false, error: "An internal server error occurred" });
  }
};

const mergeClustersSchema = z.object({
  targetClusterId: z
    .string()
    .trim()
    .min(1, "Target cluster ID is required")
    .refine(isValidId, "Invalid target cluster ID format"),
});

export const deleteCluster = async (req, res) => {
  try {
    const { clusterId } = req.params;

    if (!isValidId(clusterId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid cluster ID" });
    }

    const orgId = req.user.organization;
    const cluster = await TopicCluster.findOneAndDelete({
      _id: clusterId,
      organization: orgId,
    });

    if (!cluster) {
      return res
        .status(404)
        .json({ success: false, error: "Cluster not found" });
    }

    // Unset clusterId from any MeetingTopic subdocuments referencing this cluster
    await MeetingTopic.updateMany(
      { organization: orgId, "topics.clusterId": clusterId },
      { $set: { "topics.$[elem].clusterId": null } },
      { arrayFilters: [{ "elem.clusterId": clusterId }] },
    );

    res
      .status(200)
      .json({ success: true, message: "Cluster deleted successfully" });
  } catch (error) {
    console.error("Error deleting cluster:", error);
    res
      .status(500)
      .json({ success: false, error: "An internal server error occurred" });
  }
};

export const mergeClusters = async (req, res) => {
  try {
    const { clusterId } = req.params;

    if (!isValidId(clusterId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid source cluster ID" });
    }

    const parsed = mergeClustersSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0]?.message || "Validation error",
      });
    }

    const { targetClusterId } = parsed.data;

    if (clusterId === targetClusterId) {
      return res.status(400).json({
        success: false,
        error: "Cannot merge a cluster into itself",
      });
    }

    const orgId = req.user.organization;
    const [sourceCluster, targetCluster] = await Promise.all([
      TopicCluster.findOne({ _id: clusterId, organization: orgId }),
      TopicCluster.findOne({ _id: targetClusterId, organization: orgId }),
    ]);

    if (!sourceCluster) {
      return res
        .status(404)
        .json({ success: false, error: "Source cluster not found" });
    }
    if (!targetCluster) {
      return res
        .status(404)
        .json({ success: false, error: "Target cluster not found" });
    }

    // Reassign all topics pointing to sourceCluster to targetCluster
    await MeetingTopic.updateMany(
      { organization: orgId, "topics.clusterId": clusterId },
      { $set: { "topics.$[elem].clusterId": targetCluster._id } },
      { arrayFilters: [{ "elem.clusterId": clusterId }] },
    );

    // Re-aggregate topics for targetCluster
    const meetingTopics = await MeetingTopic.find({
      organization: orgId,
      "topics.clusterId": targetCluster._id,
    });

    const topicsInTarget = [];
    meetingTopics.forEach((mt) => {
      mt.topics.forEach((t) => {
        if (String(t.clusterId) === String(targetCluster._id)) {
          topicsInTarget.push({
            name: t.name,
            embedding: t.embedding,
            meetingId: mt.meeting?.toString() || mt._id.toString(),
          });
        }
      });
    });

    const canonicalNames = [
      ...new Set([
        ...(targetCluster.canonicalTopicNames || []),
        ...(sourceCluster.canonicalTopicNames || []),
        ...topicsInTarget.map((t) => t.name),
      ]),
    ].slice(0, 10);

    const uniqueMeetings = new Set(topicsInTarget.map((t) => t.meetingId));
    targetCluster.canonicalTopicNames = canonicalNames;
    targetCluster.meetingCount =
      uniqueMeetings.size ||
      targetCluster.meetingCount + (sourceCluster.meetingCount || 0);

    // Delete the source cluster
    await TopicCluster.findByIdAndDelete(clusterId);
    await targetCluster.save();

    res.status(200).json({ success: true, data: targetCluster });
  } catch (error) {
    console.error("Error merging clusters:", error);
    res
      .status(500)
      .json({ success: false, error: "An internal server error occurred" });
  }
};

export const extractForOrganization = async (req, res) => {
  try {
    if (rejectMismatchedOrgParam(req, res)) return;

    const orgId = req.user.organization;
    const result = await topicExtractionService.extractAllForOrg(orgId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error extracting topics for organization:", error);
    res
      .status(500)
      .json({ success: false, error: "An internal server error occurred" });
  }
};

/**
 * Fetch organization topic trends and semantic velocity analytics (Issue #2425).
 */
export const getTopicVelocityAndTrends = async (req, res) => {
  try {
    const orgId = req.user.organization;

    // Fetch meeting topics for this organization
    const meetingTopics = await MeetingTopic.find({ organization: orgId })
      .populate("meeting", "title date createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const clusters = await TopicCluster.find({ organization: orgId }).lean();

    const clusterMap = new Map();
    clusters.forEach((c) => clusterMap.set(String(c._id), c.label));

    // Calculate frequency in recent (last 30 days) vs prior (30-60 days ago)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const topicStats = new Map();

    meetingTopics.forEach((mt) => {
      const meetingDate = mt.meeting?.date
        ? new Date(mt.meeting.date)
        : new Date(mt.createdAt);
      const isRecent = meetingDate >= thirtyDaysAgo;
      const isPrior =
        meetingDate >= sixtyDaysAgo && meetingDate < thirtyDaysAgo;

      (mt.topics || []).forEach((t) => {
        const topicName = (t.name || "").trim();
        if (!topicName) return;

        const clusterName = t.clusterId
          ? clusterMap.get(String(t.clusterId)) || "General"
          : "General";

        if (!topicStats.has(topicName)) {
          topicStats.set(topicName, {
            name: topicName,
            cluster: clusterName,
            recentCount: 0,
            priorCount: 0,
            totalCount: 0,
            meetings: new Set(),
          });
        }

        const stats = topicStats.get(topicName);
        stats.totalCount += 1;
        if (isRecent) stats.recentCount += 1;
        if (isPrior) stats.priorCount += 1;
        if (mt.meeting?._id) stats.meetings.add(String(mt.meeting._id));
      });
    });

    const topicsArray = Array.from(topicStats.values()).map((stat) => {
      const growth =
        stat.priorCount === 0
          ? stat.recentCount > 0
            ? 100
            : 0
          : Math.round(
              ((stat.recentCount - stat.priorCount) / stat.priorCount) * 100,
            );

      let velocity = "stable";
      if (growth > 25) velocity = "accelerating";
      else if (growth < -25) velocity = "decelerating";

      return {
        name: stat.name,
        cluster: stat.cluster,
        recentCount: stat.recentCount,
        priorCount: stat.priorCount,
        totalCount: stat.totalCount,
        meetingCount: stat.meetings.size,
        growthPercentage: growth,
        velocity,
      };
    });

    // Sort by total frequency descending
    topicsArray.sort((a, b) => b.totalCount - a.totalCount);

    const totalTopics = topicsArray.length;
    const totalMeetings = meetingTopics.length;
    const acceleratingCount = topicsArray.filter(
      (t) => t.velocity === "accelerating",
    ).length;
    const deceleratingCount = topicsArray.filter(
      (t) => t.velocity === "decelerating",
    ).length;

    return res.status(200).json({
      success: true,
      data: {
        topics: topicsArray,
        metrics: {
          totalTopics,
          totalMeetings,
          acceleratingCount,
          deceleratingCount,
          activeClustersCount: clusters.length,
        },
      },
    });
  } catch (error) {
    console.error("Error computing topic velocity:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to compute topic velocity" });
  }
};
