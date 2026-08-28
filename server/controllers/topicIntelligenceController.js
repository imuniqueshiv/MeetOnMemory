import TopicIntelligence from "../models/topicIntelligenceModel.js";
import TopicCluster from "../models/topicClusterModel.js";
import MeetingTopic from "../models/meetingTopicModel.js";
import { generateTopicBriefing } from "../services/topicIntelligenceService.js";

export const getDashboardData = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { includeHidden } = req.query;

    const clusterQuery = { organization: orgId };
    if (includeHidden !== "true") {
      clusterQuery.isHidden = { $ne: true };
    }
    const activeClusters = await TopicCluster.find(clusterQuery);
    const activeClusterIds = activeClusters.map((c) => c._id);

    // Get all intelligence records for the active clusters of the org
    const intelRecords = await TopicIntelligence.find({
      organization: orgId,
      clusterId: { $in: activeClusterIds },
    })
      .populate("clusterId", "label isPinned isHidden")
      .sort({ weekStarting: 1 }); // Chronological

    // Group by cluster for sparklines/trends
    const trendsByCluster = {};
    intelRecords.forEach((record) => {
      if (!record.clusterId) return;
      const cid = record.clusterId._id.toString();
      if (!trendsByCluster[cid]) {
        trendsByCluster[cid] = {
          clusterId: cid,
          label: record.clusterId.label,
          history: [],
          currentTrend: record.trendDirection,
          isOrphaned: record.isOrphaned,
          isPinned: record.clusterId.isPinned || false,
          isHidden: record.clusterId.isHidden || false,
        };
      }
      trendsByCluster[cid].history.push({
        weekStarting: record.weekStarting,
        occurrences: record.occurrences,
      });
      // Update with the latest trend/orphan status
      trendsByCluster[cid].currentTrend = record.trendDirection;
      trendsByCluster[cid].isOrphaned = record.isOrphaned;
    });

    const trendsList = Object.values(trendsByCluster);
    // Sort so pinned topics are at the top, and then alphabetically
    trendsList.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return a.label.localeCompare(b.label);
    });

    res.status(200).json({ trends: trendsList });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching dashboard data", error: error.message });
  }
};

export const getOrphanedTopics = async (req, res) => {
  try {
    const orgId = req.user.organization;

    const orphanedIntel = await TopicIntelligence.find({
      organization: orgId,
      isOrphaned: true,
    })
      .populate("clusterId", "label")
      .sort({ weekStarting: -1 });

    // Deduplicate by clusterId (taking the most recent)
    const uniqueOrphans = {};
    orphanedIntel.forEach((intel) => {
      if (!intel.clusterId) return;
      const cid = intel.clusterId._id.toString();
      if (!uniqueOrphans[cid]) {
        uniqueOrphans[cid] = {
          clusterId: cid,
          label: intel.clusterId.label,
          weekStarting: intel.weekStarting,
        };
      }
    });

    res.status(200).json({ orphanedTopics: Object.values(uniqueOrphans) });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching orphaned topics",
      error: error.message,
    });
  }
};

export const getCoOccurrenceGraph = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { includeHidden } = req.query;

    const clusterQuery = { organization: orgId };
    if (includeHidden !== "true") {
      clusterQuery.isHidden = { $ne: true };
    }
    // To build the graph, we need nodes (clusters) and links (relatedTopics)
    const clusters = await TopicCluster.find(clusterQuery);
    const activeClusterIds = new Set(clusters.map((c) => c._id.toString()));

    const nodes = [];
    const links = [];

    for (const cluster of clusters) {
      nodes.push({
        id: cluster._id.toString(),
        label: cluster.label,
        val: cluster.meetingCount || 1,
        isPinned: cluster.isPinned || false,
        isHidden: cluster.isHidden || false,
      });

      const latestIntel = await TopicIntelligence.findOne({
        organization: orgId,
        clusterId: cluster._id,
      }).sort({ weekStarting: -1 });

      if (latestIntel && latestIntel.relatedTopics) {
        latestIntel.relatedTopics.forEach((rel) => {
          if (rel.clusterId && activeClusterIds.has(rel.clusterId.toString())) {
            // Avoid duplicates by enforcing id1 < id2
            const source = cluster._id.toString();
            const target = rel.clusterId.toString();
            if (source < target) {
              links.push({
                source,
                target,
                weight: rel.weight,
              });
            }
          }
        });
      }
    }

    res.status(200).json({ nodes, links });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching co-occurrence graph",
      error: error.message,
    });
  }
};

export const generateBriefing = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { clusterId } = req.params;

    const briefing = await generateTopicBriefing(orgId, clusterId);

    res.status(200).json({ briefing });
  } catch (error) {
    res.status(500).json({
      message: "Error generating topic briefing",
      error: error.message,
    });
  }
};

export const pinTopic = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const { isPinned } = req.body;
    const orgId = req.user.organization;

    const cluster = await TopicCluster.findOne({
      _id: clusterId,
      organization: orgId,
    });
    if (!cluster) {
      return res.status(404).json({ message: "Topic not found" });
    }

    cluster.isPinned = Boolean(isPinned);
    await cluster.save();

    res.status(200).json({
      success: true,
      message: `Topic ${cluster.isPinned ? "pinned" : "unpinned"} successfully`,
      cluster,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error pinning topic", error: error.message });
  }
};

export const hideTopic = async (req, res) => {
  try {
    const { clusterId } = req.params;
    const { isHidden } = req.body;
    const orgId = req.user.organization;

    const cluster = await TopicCluster.findOne({
      _id: clusterId,
      organization: orgId,
    });
    if (!cluster) {
      return res.status(404).json({ message: "Topic not found" });
    }

    cluster.isHidden = Boolean(isHidden);
    await cluster.save();

    res.status(200).json({
      success: true,
      message: `Topic ${cluster.isHidden ? "hidden" : "unhidden"} successfully`,
      cluster,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error hiding topic", error: error.message });
  }
};

export const mergeTopics = async (req, res) => {
  try {
    const { sourceClusterId, targetClusterId } = req.body;
    const orgId = req.user.organization;

    if (!sourceClusterId || !targetClusterId) {
      return res
        .status(400)
        .json({ message: "Source and Target topic IDs are required" });
    }
    if (sourceClusterId === targetClusterId) {
      return res
        .status(400)
        .json({ message: "Cannot merge a topic into itself" });
    }

    const sourceCluster = await TopicCluster.findOne({
      _id: sourceClusterId,
      organization: orgId,
    });
    const targetCluster = await TopicCluster.findOne({
      _id: targetClusterId,
      organization: orgId,
    });

    if (!sourceCluster || !targetCluster) {
      return res
        .status(404)
        .json({ message: "Source or Target topic not found" });
    }

    // 1. Update MeetingTopic references
    await MeetingTopic.updateMany(
      { "topics.clusterId": sourceClusterId, organization: orgId },
      { $set: { "topics.$[elem].clusterId": targetClusterId } },
      { arrayFilters: [{ "elem.clusterId": sourceClusterId }] },
    );

    // 2. Merge TopicIntelligence records
    const sourceIntels = await TopicIntelligence.find({
      clusterId: sourceClusterId,
      organization: orgId,
    });
    for (const sourceIntel of sourceIntels) {
      const targetIntel = await TopicIntelligence.findOne({
        clusterId: targetClusterId,
        weekStarting: sourceIntel.weekStarting,
        organization: orgId,
      });

      if (targetIntel) {
        targetIntel.occurrences += sourceIntel.occurrences;

        // Merge relatedTopics
        const mergedRelated = [...(targetIntel.relatedTopics || [])];
        if (sourceIntel.relatedTopics) {
          sourceIntel.relatedTopics.forEach((sourceRel) => {
            if (!sourceRel.clusterId) return;
            const sId = sourceRel.clusterId.toString();
            // Don't link to the source or target itself
            if (sId === sourceClusterId || sId === targetClusterId) return;

            const existing = mergedRelated.find(
              (r) => r.clusterId && r.clusterId.toString() === sId,
            );
            if (existing) {
              existing.weight =
                (existing.weight || 0) + (sourceRel.weight || 0);
            } else {
              mergedRelated.push(sourceRel);
            }
          });
        }
        targetIntel.relatedTopics = mergedRelated;
        await targetIntel.save();
        await sourceIntel.deleteOne();
      } else {
        sourceIntel.clusterId = targetClusterId;
        // Filter out self-references
        if (sourceIntel.relatedTopics) {
          sourceIntel.relatedTopics = sourceIntel.relatedTopics.filter(
            (r) =>
              r.clusterId &&
              r.clusterId.toString() !== targetClusterId &&
              r.clusterId.toString() !== sourceClusterId,
          );
        }
        await sourceIntel.save();
      }
    }

    // 3. Update relatedTopics in other TopicIntelligence documents pointing to sourceClusterId
    await TopicIntelligence.updateMany(
      { "relatedTopics.clusterId": sourceClusterId, organization: orgId },
      { $set: { "relatedTopics.$[elem].clusterId": targetClusterId } },
      { arrayFilters: [{ "elem.clusterId": sourceClusterId }] },
    );

    // De-duplicate relatedTopics
    const affectedIntels = await TopicIntelligence.find({
      organization: orgId,
      "relatedTopics.clusterId": targetClusterId,
    });
    for (const intel of affectedIntels) {
      const merged = [];
      intel.relatedTopics.forEach((rel) => {
        if (!rel.clusterId) return;
        const rId = rel.clusterId.toString();
        // Skip self-references
        if (rId === intel.clusterId.toString()) return;

        const existing = merged.find(
          (m) => m.clusterId && m.clusterId.toString() === rId,
        );
        if (existing) {
          existing.weight = (existing.weight || 0) + (rel.weight || 0);
        } else {
          merged.push(rel);
        }
      });
      intel.relatedTopics = merged;
      await intel.save();
    }

    // 4. Update target cluster stats
    targetCluster.meetingCount =
      (targetCluster.meetingCount || 0) + (sourceCluster.meetingCount || 0);
    targetCluster.canonicalTopicNames = Array.from(
      new Set([
        ...(targetCluster.canonicalTopicNames || []),
        ...(sourceCluster.canonicalTopicNames || []),
      ]),
    );
    await targetCluster.save();

    // 5. Delete source cluster
    await sourceCluster.deleteOne();

    res
      .status(200)
      .json({ success: true, message: "Topics merged successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error merging topics", error: error.message });
  }
};

export const exportTopicIntelligence = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { format } = req.query; // 'json' or 'csv'

    const clusters = await TopicCluster.find({ organization: orgId }).sort({
      label: 1,
    });
    const exportData = [];

    for (const cluster of clusters) {
      const intels = await TopicIntelligence.find({
        organization: orgId,
        clusterId: cluster._id,
      }).sort({ weekStarting: -1 });

      if (intels.length > 0) {
        intels.forEach((intel) => {
          exportData.push({
            topicLabel: cluster.label,
            description: cluster.description || "",
            isPinned: cluster.isPinned || false,
            isHidden: cluster.isHidden || false,
            weekStarting: intel.weekStarting.toISOString().split("T")[0],
            occurrences: intel.occurrences,
            trendDirection: intel.trendDirection,
            sentimentScore: intel.sentimentScore,
            isOrphaned: intel.isOrphaned,
            meetingCount: cluster.meetingCount || 0,
          });
        });
      } else {
        exportData.push({
          topicLabel: cluster.label,
          description: cluster.description || "",
          isPinned: cluster.isPinned || false,
          isHidden: cluster.isHidden || false,
          weekStarting: "N/A",
          occurrences: 0,
          trendDirection: "stable",
          sentimentScore: "N/A",
          isOrphaned: false,
          meetingCount: cluster.meetingCount || 0,
        });
      }
    }

    if (format === "csv") {
      const fields = [
        "topicLabel",
        "description",
        "isPinned",
        "isHidden",
        "weekStarting",
        "occurrences",
        "trendDirection",
        "sentimentScore",
        "isOrphaned",
        "meetingCount",
      ];
      let csvContent = fields.join(",") + "\n";
      exportData.forEach((row) => {
        const line = fields.map((field) => {
          const value = row[field];
          if (value === null || value === undefined) return "";
          const strValue = String(value);
          if (
            strValue.includes(",") ||
            strValue.includes('"') ||
            strValue.includes("\n")
          ) {
            return `"${strValue.replace(/"/g, '""')}"`;
          }
          return strValue;
        });
        csvContent += line.join(",") + "\n";
      });

      res.setHeader(
        "Content-Disposition",
        "attachment; filename=topic_intelligence.csv",
      );
      res.setHeader("Content-Type", "text/csv");
      return res.status(200).send(csvContent);
    }

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=topic_intelligence.json",
    );
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(exportData);
  } catch (error) {
    res.status(500).json({
      message: "Error exporting topic intelligence",
      error: error.message,
    });
  }
};
