import mongoose from "mongoose";
import * as topicExtractionService from "../services/topicExtractionService.js";
import MeetingTopic from "../models/meetingTopicModel.js";
import TopicCluster from "../models/topicClusterModel.js";
import Meeting from "../models/meetingModel.js";
import { canAccessMeetingDoc } from "../middleware/rbac.js";
import { AppError } from "../utils/errors.js";

/** Cluster labels appear in chart axes and legends; long ones break the view. */
const MAX_CLUSTER_LABEL_LENGTH = 120;

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
    const { label } = req.body;

    if (!isValidId(clusterId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid cluster ID" });
    }

    // `if (!label)` accepted any truthy value, so a number or an object reached
    // `cluster.label = label` and was coerced on save.
    if (typeof label !== "string" || label.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Label is required" });
    }
    if (label.trim().length > MAX_CLUSTER_LABEL_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `Label cannot exceed ${MAX_CLUSTER_LABEL_LENGTH} characters`,
      });
    }

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
