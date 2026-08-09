import {
  buildOrganizationGraph,
  buildMeetingGraph,
  findPath,
  getGraphAnalytics,
  searchEntities,
} from "../services/knowledgeGraphService.js";
import mongoose from "mongoose";

/**
 * Knowledge Graph Controller
 * Handles HTTP requests for knowledge graph endpoints
 */

/**
 * @desc Get full organization graph
 * @route GET /api/graph/organization/:orgId
 * @access Private
 */
export const getOrganizationGraph = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { startDate, endDate, entityTypes } = req.query;

    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ message: "Invalid organization ID" });
    }

    // Check organization access
    if (orgId !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (entityTypes) filters.entityTypes = entityTypes.split(",");

    const graph = await buildOrganizationGraph(orgId, filters);

    res.status(200).json(graph);
  } catch (error) {
    console.error("Error fetching organization graph:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get meeting-specific subgraph
 * @route GET /api/graph/meeting/:meetingId
 * @access Private
 */
export const getMeetingGraph = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!mongoose.isValidObjectId(meetingId)) {
      return res.status(400).json({ message: "Invalid meeting ID" });
    }

    const graph = await buildMeetingGraph(meetingId);

    // Check organization access
    const Meeting = (await import("../models/meetingModel.js")).default;
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (meeting.organization.toString() !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    res.status(200).json(graph);
  } catch (error) {
    console.error("Error fetching meeting graph:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get specific entity and its relationships
 * @route GET /api/graph/entity/:type/:id
 * @access Private
 */
export const getEntity = async (req, res) => {
  try {
    const { type, id } = req.params;
    const orgId = req.user.organization;

    const graph = await buildOrganizationGraph(orgId);
    const { nodes, edges } = graph;

    const entityId = `${type}-${id}`;
    const entity = nodes.find((n) => n.id === entityId);

    if (!entity) {
      return res.status(404).json({ message: "Entity not found" });
    }

    // Find all relationships
    const relationships = edges.filter(
      (e) => e.source === entityId || e.target === entityId,
    );

    // Get related entities
    const relatedIds = relationships.map((e) =>
      e.source === entityId ? e.target : e.source,
    );
    const relatedEntities = nodes.filter((n) => relatedIds.includes(n.id));

    res.status(200).json({
      entity,
      relationships,
      relatedEntities,
    });
  } catch (error) {
    console.error("Error fetching entity:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Find path between two entities
 * @route GET /api/graph/path
 * @access Private
 */
export const findPathEndpoint = async (req, res) => {
  try {
    const { startId, endId } = req.query;
    const orgId = req.user.organization;

    if (!startId || !endId) {
      return res.status(400).json({ message: "Start and end IDs required" });
    }

    const path = await findPath(orgId, startId, endId);

    res.status(200).json(path);
  } catch (error) {
    console.error("Error finding path:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Get graph analytics
 * @route GET /api/graph/analytics/:orgId
 * @access Private
 */
export const getAnalytics = async (req, res) => {
  try {
    const { orgId } = req.params;

    if (!mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ message: "Invalid organization ID" });
    }

    if (orgId !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const analytics = await getGraphAnalytics(orgId);

    res.status(200).json(analytics);
  } catch (error) {
    console.error("Error fetching graph analytics:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * @desc Export graph data
 * @route POST /api/graph/export
 * @access Private
 */
export const exportGraph = async (req, res) => {
  try {
    const { format = "json", orgId } = req.body;
    const organizationId = orgId || req.user.organization;

    if (organizationId !== req.user.organization.toString()) {
      return res
        .status(403)
        .json({ message: "Forbidden: Not part of organization" });
    }

    const graph = await buildOrganizationGraph(organizationId);

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=knowledge-graph.json",
      );
      res.status(200).json(graph);
    } else if (format === "csv") {
      // Convert to CSV format
      const csvNodes = convertToCSV(graph.nodes, "nodes");
      const csvEdges = convertToCSV(graph.edges, "edges");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=knowledge-graph.csv",
      );
      res.status(200).send(`${csvNodes}\n\n${csvEdges}`);
    } else {
      res.status(400).json({ message: "Invalid format. Use 'json' or 'csv'" });
    }
  } catch (error) {
    console.error("Error exporting graph:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

/**
 * Helper to convert array to CSV
 */
const convertToCSV = (data, _type) => {
  if (!data || data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const rows = data.map((item) =>
    headers
      .map((header) => {
        const value = item[header];
        if (typeof value === "object") {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      })
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n");
};

/**
 * @desc Search entities
 * @route GET /api/graph/search
 * @access Private
 */
export const search = async (req, res) => {
  try {
    const { query, type } = req.query;
    const orgId = req.user.organization;

    if (!query) {
      return res.status(400).json({ message: "Search query required" });
    }

    const results = await searchEntities(orgId, query, type);

    res.status(200).json({ results, count: results.length });
  } catch (error) {
    console.error("Error searching entities:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
