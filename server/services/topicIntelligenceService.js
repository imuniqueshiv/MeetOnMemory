import MeetingTopic from "../models/meetingTopicModel.js";
import TopicCluster from "../models/topicClusterModel.js";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
import TopicIntelligence from "../models/topicIntelligenceModel.js";
import { generateText } from "./GenerativeAIService.js";
import Meeting from "../models/meetingModel.js";
import Transcript from "../models/transcriptModel.js";

/**
 * Calculates weekly occurrences for all topics in an organization and determines trends.
 */
export const calculateWeeklyTrends = async (orgId) => {
  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setHours(0, 0, 0, 0);
  currentWeekStart.setDate(now.getDate() - now.getDay()); // Sunday

  const prevWeekStart = new Date(currentWeekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const prevPrevWeekStart = new Date(prevWeekStart);
  prevPrevWeekStart.setDate(prevPrevWeekStart.getDate() - 7);

  // 1. Get all meetings in the current week and previous week
  const currWeekMeetings = await Meeting.find({
    organization: orgId,
    startTime: { $gte: currentWeekStart },
  }).select("_id");
  const currWeekMeetingIds = currWeekMeetings.map((m) => m._id);

  const prevWeekMeetings = await Meeting.find({
    organization: orgId,
    startTime: { $gte: prevWeekStart, $lt: currentWeekStart },
  }).select("_id");
  const prevWeekMeetingIds = prevWeekMeetings.map((m) => m._id);

  // 2. Count topic occurrences in the current week
  const currMeetingTopics = await MeetingTopic.find({
    meeting: { $in: currWeekMeetingIds },
  });

  const currOccurrences = {}; // clusterId -> count
  currMeetingTopics.forEach((mt) => {
    // Unique clusters per meeting
    const clustersInMeeting = new Set(
      mt.topics.filter((t) => t.clusterId).map((t) => t.clusterId.toString()),
    );
    clustersInMeeting.forEach((cid) => {
      currOccurrences[cid] = (currOccurrences[cid] || 0) + 1;
    });
  });

  // 3. Count topic occurrences in the previous week
  const prevMeetingTopics = await MeetingTopic.find({
    meeting: { $in: prevWeekMeetingIds },
  });

  const prevOccurrences = {};
  prevMeetingTopics.forEach((mt) => {
    const clustersInMeeting = new Set(
      mt.topics.filter((t) => t.clusterId).map((t) => t.clusterId.toString()),
    );
    clustersInMeeting.forEach((cid) => {
      prevOccurrences[cid] = (prevOccurrences[cid] || 0) + 1;
    });
  });

  // 4. Upsert TopicIntelligence records for the current week
  const allClusterIds = new Set([
    ...Object.keys(currOccurrences),
    ...Object.keys(prevOccurrences),
  ]);

  for (const cid of allClusterIds) {
    const currCount = currOccurrences[cid] || 0;
    const prevCount = prevOccurrences[cid] || 0;

    let trend = "stable";
    if (currCount > prevCount) trend = "rising";
    else if (currCount < prevCount) trend = "declining";

    await TopicIntelligence.findOneAndUpdate(
      {
        organization: orgId,
        clusterId: cid,
        weekStarting: currentWeekStart,
      },
      {
        $set: {
          occurrences: currCount,
          trendDirection: trend,
        },
      },
      { upsert: true, new: true },
    );
  }

  return { success: true, processedClusters: allClusterIds.size };
};

/**
 * Detects orphaned topics: older than 30 days, no ActionItems, no Decisions.
 */
export const detectOrphanedTopics = async (orgId) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const clusters = await TopicCluster.find({ organization: orgId });

  let orphanedCount = 0;
  for (const cluster of clusters) {
    // Find all meeting topics associated with this cluster
    const meetingTopics = await MeetingTopic.find({
      organization: orgId,
      "topics.clusterId": cluster._id,
    }).populate("meeting");

    // If no meetings, skip
    if (meetingTopics.length === 0) continue;

    // Check if the most recent mention was over 30 days ago
    let mostRecentDate = new Date(0);
    const meetingIds = [];
    meetingTopics.forEach((mt) => {
      if (mt.meeting && mt.meeting.startTime > mostRecentDate) {
        mostRecentDate = mt.meeting.startTime;
      }
      meetingIds.push(mt.meeting ? mt.meeting._id : null);
    });

    if (mostRecentDate > thirtyDaysAgo) {
      // Not orphaned due to age
      await TopicIntelligence.updateMany(
        { organization: orgId, clusterId: cluster._id },
        { $set: { isOrphaned: false } },
      );
      continue;
    }

    // Check for ActionItems in those meetings
    const actionItems = await ActionItem.countDocuments({
      meeting: { $in: meetingIds.filter(Boolean) },
    });

    // Check for Decisions in those meetings
    const decisions = await Decision.countDocuments({
      meeting: { $in: meetingIds.filter(Boolean) },
    });

    const isOrphaned = actionItems === 0 && decisions === 0;
    if (isOrphaned) orphanedCount++;

    // Update the latest TopicIntelligence record
    const latestIntel = await TopicIntelligence.findOne({
      organization: orgId,
      clusterId: cluster._id,
    }).sort({ weekStarting: -1 });

    if (latestIntel) {
      latestIntel.isOrphaned = isOrphaned;
      await latestIntel.save();
    }
  }

  return { orphanedCount };
};

/**
 * Builds a co-occurrence graph for topics in meetings.
 */
export const buildCoOccurrenceGraph = async (orgId) => {
  const meetingTopics = await MeetingTopic.find({ organization: orgId });
  const coOccurrenceMap = {}; // cid1|cid2 -> weight

  meetingTopics.forEach((mt) => {
    const clusterIds = [
      ...new Set(
        mt.topics.filter((t) => t.clusterId).map((t) => t.clusterId.toString()),
      ),
    ];

    for (let i = 0; i < clusterIds.length; i++) {
      for (let j = i + 1; j < clusterIds.length; j++) {
        const id1 = clusterIds[i];
        const id2 = clusterIds[j];
        // Ensure consistent ordering to avoid a|b and b|a
        const key = id1 < id2 ? `${id1}|${id2}` : `${id2}|${id1}`;
        coOccurrenceMap[key] = (coOccurrenceMap[key] || 0) + 1;
      }
    }
  });

  // Now, update TopicIntelligence with relatedTopics
  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setHours(0, 0, 0, 0);
  currentWeekStart.setDate(now.getDate() - now.getDay());

  const relationUpdates = {}; // cid -> [{clusterId, weight}]

  for (const [key, weight] of Object.entries(coOccurrenceMap)) {
    const [id1, id2] = key.split("|");
    if (!relationUpdates[id1]) relationUpdates[id1] = [];
    if (!relationUpdates[id2]) relationUpdates[id2] = [];

    relationUpdates[id1].push({ clusterId: id2, weight });
    relationUpdates[id2].push({ clusterId: id1, weight });
  }

  for (const [cid, relations] of Object.entries(relationUpdates)) {
    // Keep top 10 relations
    relations.sort((a, b) => b.weight - a.weight);
    const topRelations = relations.slice(0, 10);

    await TopicIntelligence.findOneAndUpdate(
      {
        organization: orgId,
        clusterId: cid,
        weekStarting: currentWeekStart,
      },
      {
        $set: { relatedTopics: topRelations },
      },
      { upsert: true },
    );
  }

  return { success: true };
};

/**
 * Generates an AI briefing for a specific topic cluster, summarizing past discussions.
 */
export const generateTopicBriefing = async (orgId, clusterId) => {
  const cluster = await TopicCluster.findOne({
    _id: clusterId,
    organization: orgId,
  });
  if (!cluster) {
    throw new Error("Topic cluster not found");
  }

  // Find meetings where this topic was discussed
  const meetingTopics = await MeetingTopic.find({
    organization: orgId,
    "topics.clusterId": clusterId,
  }).populate("meeting");

  if (meetingTopics.length === 0) {
    return "No discussion history found for this topic.";
  }

  const meetingIds = meetingTopics
    .filter((mt) => mt.meeting)
    .map((mt) => mt.meeting._id);

  // Fetch transcripts for these meetings
  const transcripts = await Transcript.find({ meeting: { $in: meetingIds } });

  // Extract relevant text
  // (In a real scenario, we might only pass segments associated with the topic's timeRanges,
  // but for simplicity we'll pass a summary or snippets)
  let contextChunks = [];
  meetingTopics.forEach((mt) => {
    if (!mt.meeting) return;
    const transcript = transcripts.find(
      (tr) => tr.meeting.toString() === mt.meeting._id.toString(),
    );
    if (!transcript) return;

    // Find the specific topic entries
    const topics = mt.topics.filter(
      (t) => t.clusterId && t.clusterId.toString() === clusterId.toString(),
    );
    topics.forEach((t) => {
      t.timeRanges.forEach((tr) => {
        const segments = transcript.segments.filter(
          (s) => s.startTime >= tr.start && s.endTime <= tr.end,
        );
        const text = segments.map((s) => `${s.speaker}: ${s.text}`).join(" ");
        if (text) {
          contextChunks.push(
            `From meeting '${mt.meeting.title}' on ${mt.meeting.startTime}:\n${text}`,
          );
        }
      });
    });
  });

  if (contextChunks.length === 0) {
    return "Could not extract specific conversation segments for this topic.";
  }

  const contextStr = contextChunks.join("\n\n");
  const prompt = `You are an AI assistant. Please provide a concise, executive briefing on the topic "${cluster.label}" based on the following discussion history across multiple meetings. Highlight key decisions, recurring themes, and any outstanding issues.\n\nContext:\n${contextStr}`;

  const briefing = await generateText(prompt, "Topic Briefing");
  return briefing;
};
