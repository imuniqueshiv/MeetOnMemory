import * as topicExtractionService from "../services/topicExtractionService.js";
import MeetingTopic from "../models/meetingTopicModel.js";
import TopicCluster from "../models/topicClusterModel.js";

export const extractForMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const orgId = req.user.organization;
    const result = await topicExtractionService.extractTopics(meetingId, orgId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error extracting topics:", error);
    res
      .status(500)
      .json({ success: false, error: "An internal server error occurred" });
  }
};

export const getTopicsForMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
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

export const getTopicClusters = async (req, res) => {
  try {
    const orgId = req.user.organization;
    // Re-run clustering if needed or simply fetch? Let's just fetch for now, optionally trigger cluster
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

    if (!label) {
      return res
        .status(400)
        .json({ success: false, error: "Label is required" });
    }

    const cluster = await TopicCluster.findById(clusterId);
    if (!cluster) {
      return res
        .status(404)
        .json({ success: false, error: "Cluster not found" });
    }

    cluster.label = label;
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
