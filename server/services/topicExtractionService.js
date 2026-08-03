import Meeting from "../models/meetingModel.js";
import Transcript from "../models/transcriptModel.js";
import MeetingTopic from "../models/meetingTopicModel.js";
import TopicCluster from "../models/topicClusterModel.js";
import { generateText, parseJsonOutput } from "./GenerativeAIService.js";
import { embedText } from "../utils/embeddingUtils.js";
import cosineSimilarity from "../utils/similarity.js";

const CLUSTER_SIMILARITY_THRESHOLD = 0.85;

/**
 * Extracts 3-8 topics from a meeting's transcript using Generative AI.
 */
export const extractTopics = async (meetingId, userOrgId) => {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new Error("Meeting not found");

  if (meeting.organization.toString() !== userOrgId.toString()) {
    throw new Error("Unauthorized access to meeting");
  }

  const transcript = await Transcript.findOne({ meeting: meetingId });
  if (!transcript || !transcript.segments || transcript.segments.length === 0) {
    throw new Error("No transcript found for meeting");
  }

  // To help the AI map back to timestamps, include them in the prompt context
  const transcriptTextWithTimes = transcript.segments
    .map(
      (s) =>
        `[${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s] ${s.speaker}: ${s.text}`,
    )
    .join("\n");

  const prompt = `
You are an AI tasked with analyzing a meeting transcript to extract the 3 to 8 most important topics discussed.
For each topic, provide:
- name: A concise, descriptive name (1-4 words).
- confidence: Your confidence (0-100) that this is a major topic.
- keywords: 3-5 related keywords.
- timeRanges: The start and end times (in seconds) where this topic was discussed. You can have multiple time ranges if discussed multiple times.

Transcript:
${transcriptTextWithTimes}

Return ONLY a JSON array matching this format exactly:
[
  {
    "name": "Topic Name",
    "confidence": 95,
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "timeRanges": [
      { "start": 0.5, "end": 45.2 }
    ]
  }
]
`;

  const outputText = await generateText(prompt, "Topic Extraction");
  const extractedTopics = parseJsonOutput(outputText);

  if (!extractedTopics || !Array.isArray(extractedTopics)) {
    throw new Error("Failed to parse extracted topics from AI");
  }

  // Ensure we have 3-8 topics
  const topicsToSave = extractedTopics.slice(0, 8);

  // Generate embeddings for each topic
  for (const topic of topicsToSave) {
    topic.embedding = await embedText(
      topic.name + " " + (topic.keywords || []).join(" "),
    );
  }

  // Save to database (replace existing if any) atomically
  const meetingTopic = await MeetingTopic.findOneAndUpdate(
    { meeting: meetingId },
    {
      $set: {
        organization: meeting.organization,
        topics: topicsToSave,
      },
    },
    { upsert: true, new: true },
  );

  return meetingTopic;
};

/**
 * Clusters topics across all meetings for an organization.
 */
export const clusterTopics = async (orgId) => {
  const meetingTopics = await MeetingTopic.find({ organization: orgId });

  // Flatten all topics
  let allTopics = [];
  meetingTopics.forEach((mt) => {
    mt.topics.forEach((t) => {
      allTopics.push({
        topicId: t._id,
        meetingTopicId: mt._id,
        name: t.name,
        embedding: t.embedding,
        clusterId: t.clusterId,
      });
    });
  });

  if (allTopics.length === 0) return [];

  // Get existing clusters
  let existingClusters = await TopicCluster.find({ organization: orgId });

  const assignCluster = async (topic) => {
    let bestCluster = null;
    let highestSim = -1;

    for (const cluster of existingClusters) {
      const sim = cosineSimilarity(topic.embedding, cluster.centroidEmbedding);
      if (sim > highestSim) {
        highestSim = sim;
        bestCluster = cluster;
      }
    }

    if (highestSim > CLUSTER_SIMILARITY_THRESHOLD && bestCluster) {
      return bestCluster;
    } else {
      // Create new cluster
      const newCluster = new TopicCluster({
        organization: orgId,
        label: topic.name, // Initial label
        canonicalTopicNames: [topic.name],
        meetingCount: 0, // Will be recalculated
        centroidEmbedding: topic.embedding,
      });
      existingClusters.push(newCluster);
      return newCluster;
    }
  };

  // Greedily assign topics to clusters
  for (const topic of allTopics) {
    const assignedCluster = await assignCluster(topic);
    topic.newClusterId = assignedCluster._id || assignedCluster.id; // handle unsaved
  }

  // Save new clusters
  const unsavedClusters = existingClusters.filter((c) => c.isNew);
  if (unsavedClusters.length > 0) {
    await TopicCluster.insertMany(unsavedClusters);
  }

  // Re-calculate cluster centroids, counts, and names
  existingClusters = await TopicCluster.find({ organization: orgId });

  // Group topics by cluster
  const clusterTopicsMap = {};
  existingClusters.forEach((c) => (clusterTopicsMap[c._id.toString()] = []));
  allTopics.forEach((t) => {
    if (t.newClusterId) {
      clusterTopicsMap[t.newClusterId.toString()].push(t);
    }
  });

  // Update clusters
  for (const cluster of existingClusters) {
    const topicsInCluster = clusterTopicsMap[cluster._id.toString()] || [];

    // Update centroid
    if (topicsInCluster.length > 0) {
      const dim = topicsInCluster[0].embedding.length;
      const newCentroid = new Array(dim).fill(0);
      topicsInCluster.forEach((t) => {
        for (let i = 0; i < dim; i++) newCentroid[i] += t.embedding[i];
      });
      for (let i = 0; i < dim; i++) newCentroid[i] /= topicsInCluster.length;

      cluster.centroidEmbedding = newCentroid;

      // Update canonical names
      cluster.canonicalTopicNames = [
        ...new Set(topicsInCluster.map((t) => t.name)),
      ].slice(0, 5);

      // Update meeting count (unique meetings)
      const meetingSet = new Set(
        topicsInCluster.map((t) => t.meetingTopicId.toString()),
      );
      cluster.meetingCount = meetingSet.size;

      if (!cluster.isUserRenamed && topicsInCluster.length > 0) {
        // Simple strategy: use the most frequent topic name
        const nameFreq = {};
        topicsInCluster.forEach((t) => {
          nameFreq[t.name] = (nameFreq[t.name] || 0) + 1;
        });
        const bestName = Object.keys(nameFreq).reduce((a, b) =>
          nameFreq[a] > nameFreq[b] ? a : b,
        );
        cluster.label = bestName;
      }

      await cluster.save();
    }
  }

  // Update topics with their new clusterId
  for (const mt of meetingTopics) {
    let modified = false;
    mt.topics.forEach((t) => {
      const match = allTopics.find((at) => at.topicId === t._id);
      if (
        match &&
        match.newClusterId &&
        String(match.newClusterId) !== String(t.clusterId)
      ) {
        t.clusterId = match.newClusterId;
        modified = true;
      }
    });
    if (modified) await mt.save();
  }

  return existingClusters;
};
