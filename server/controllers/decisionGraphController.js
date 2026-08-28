import Decision from "../models/decisionModel.js";
import Meeting from "../models/meetingModel.js";
import mongoose from "mongoose";
import { escapeRegex } from "../utils/regex.js";

const DECISION_STATUSES = ["open", "in-progress", "resolved", "superseded"];

/**
 * @desc    Get the decision dependency graph for the current organization
 * @route   GET /api/decision-graph
 * @access  Private
 */
export const getDecisionGraph = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { search, status } = req.query || {};

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = (page - 1) * limit;

    const filter = {
      organization: orgId,
      lifecycleState: { $ne: "expired" },
    };

    if (
      status &&
      ["open", "in-progress", "resolved", "superseded"].includes(status)
    ) {
      filter.status = status;
    }

    if (search && typeof search === "string") {
      // Escape regex metacharacters so user input can't be compiled as a live
      // regex (ReDoS / regex injection). See `utils/regex.js` (Issue #1770).
      const escapedSearch = escapeRegex(search);
      filter.text = { $regex: escapedSearch, $options: "i" };
    }

    const total = await Decision.countDocuments(filter);

    // Fetch paginated decisions for this org
    const decisions = await Decision.find(filter)
      .select(
        "text owner status importanceScore relatesTo supersededByMemory sourceMeetingId createdAt updatedAt lifecycleState",
      )
      .sort({ importanceScore: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const nodes = [];
    const edges = [];

    // To ensure edges only point to existing nodes in the graph window
    const validNodeIds = new Set(decisions.map((d) => d._id.toString()));

    decisions.forEach((decision) => {
      const sourceId = decision._id.toString();

      nodes.push({
        id: sourceId,
        label: decision.text,
        owner: decision.owner,
        status: decision.status,
        importanceScore: decision.importanceScore || 0,
        sourceMeetingId: decision.sourceMeetingId,
        lifecycleState: decision.lifecycleState,
        isSuperseded: !!decision.supersededByMemory,
      });

      // relatesTo edges
      if (decision.relatesTo && decision.relatesTo.length > 0) {
        decision.relatesTo.forEach((rel) => {
          const targetId = rel.target?.toString();
          if (targetId && validNodeIds.has(targetId)) {
            edges.push({
              source: sourceId,
              target: targetId,
              type: "relatesTo",
              confidence: rel.confidence || 100,
            });
          }
        });
      }

      // supersededByMemory edge
      if (decision.supersededByMemory) {
        const targetId = decision.supersededByMemory.toString();
        if (validNodeIds.has(targetId)) {
          edges.push({
            source: sourceId,
            target: targetId,
            type: "supersededBy",
          });
        }
      }
    });

    const totalPages = Math.ceil(total / limit) || 1;
    const hasMore = page < totalPages;

    res.status(200).json({
      nodes,
      edges,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasMore,
      },
    });
  } catch (error) {
    console.error("Error fetching decision graph:", error);
    res.status(500).json({ message: "Server error fetching decision graph" });
  }
};

/**
 * @desc    Get immediate neighbors of a specific decision
 * @route   GET /api/decision-graph/:id/neighbors
 * @access  Private
 */
export const getDecisionNeighbors = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user.organization;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid decision ID" });
    }

    const decision = await Decision.findOne({ _id: id, organization: orgId })
      .select("relatesTo supersededByMemory")
      .lean();

    if (!decision) {
      return res.status(404).json({ message: "Decision not found" });
    }

    const targetIds = [
      ...(decision.relatesTo || []).map((r) => r.target),
      decision.supersededByMemory,
    ].filter(Boolean);

    const neighbors = await Decision.find({
      organization: orgId,
      lifecycleState: { $ne: "expired" },
      $or: [
        { _id: { $in: targetIds } },
        { "relatesTo.target": id },
        { supersededByMemory: id },
      ],
    })
      .select("text owner status importanceScore relatesTo supersededByMemory")
      .lean();

    res.status(200).json({ neighbors });
  } catch (error) {
    console.error("Error fetching decision neighbors:", error);
    res
      .status(500)
      .json({ message: "Server error fetching decision neighbors" });
  }
};

/**
 * @desc    Create a new decision node in the current organization
 * @route   POST /api/decision-graph
 * @access  Private (knowledge:create)
 */
export const createDecision = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const {
      text,
      owner = "",
      status = "open",
      sourceMeetingId,
    } = req.body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "Decision text is required" });
    }
    if (status && !DECISION_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid decision status" });
    }
    if (!sourceMeetingId || !mongoose.isValidObjectId(sourceMeetingId)) {
      return res
        .status(400)
        .json({ message: "A valid sourceMeetingId is required" });
    }

    // The meeting must belong to the caller's organization — prevents attaching
    // a decision to another org's meeting.
    const meeting = await Meeting.findOne({
      _id: sourceMeetingId,
      organization: orgId,
    }).select("_id");
    if (!meeting) {
      return res
        .status(404)
        .json({ message: "Source meeting not found in your organization" });
    }

    const decision = await Decision.create({
      text: text.trim(),
      owner: typeof owner === "string" ? owner : "",
      status,
      sourceMeetingId,
      organization: orgId,
    });

    return res.status(201).json({
      decision: {
        id: decision._id.toString(),
        label: decision.text,
        owner: decision.owner,
        status: decision.status,
      },
    });
  } catch (error) {
    console.error("Error creating decision:", error);
    return res.status(500).json({ message: "Server error creating decision" });
  }
};

/**
 * Load two decisions in the caller's org, or return the HTTP error to send.
 * Guards ownership + existence + self-reference for both link and supersede.
 */
const loadEdgePair = async (orgId, sourceId, targetId) => {
  if (
    !mongoose.isValidObjectId(sourceId) ||
    !mongoose.isValidObjectId(targetId)
  ) {
    return { error: { status: 400, message: "Invalid decision ID" } };
  }
  if (String(sourceId) === String(targetId)) {
    return {
      error: { status: 400, message: "A decision cannot link to itself" },
    };
  }
  const [source, target] = await Promise.all([
    Decision.findOne({ _id: sourceId, organization: orgId }),
    Decision.findOne({ _id: targetId, organization: orgId }).select("_id"),
  ]);
  if (!source || !target) {
    return {
      error: {
        status: 404,
        message: "Decision not found in your organization",
      },
    };
  }
  return { source, target };
};

/**
 * @desc    Add a relatesTo edge from :id to a target decision
 * @route   POST /api/decision-graph/:id/relations
 * @access  Private (knowledge:edit)
 */
export const linkDecisions = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { id } = req.params;
    const { targetId, confidence } = req.body || {};

    const { source, error } = await loadEdgePair(orgId, id, targetId);
    if (error) return res.status(error.status).json({ message: error.message });

    const alreadyLinked = (source.relatesTo || []).some(
      (rel) => rel.target?.toString() === String(targetId),
    );
    if (alreadyLinked) {
      return res
        .status(409)
        .json({ message: "These decisions are already linked" });
    }

    const conf =
      typeof confidence === "number" && confidence >= 0 && confidence <= 100
        ? confidence
        : 100;
    source.relatesTo.push({ target: targetId, confidence: conf });
    await source.save();

    return res.status(200).json({
      edge: {
        source: String(id),
        target: String(targetId),
        type: "relatesTo",
        confidence: conf,
      },
    });
  } catch (error) {
    console.error("Error linking decisions:", error);
    return res.status(500).json({ message: "Server error linking decisions" });
  }
};

/**
 * @desc    Mark :id as superseded by a target decision
 * @route   POST /api/decision-graph/:id/supersede
 * @access  Private (knowledge:edit)
 */
export const supersedeDecision = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { id } = req.params;
    const { targetId } = req.body || {};

    const { source, error } = await loadEdgePair(orgId, id, targetId);
    if (error) return res.status(error.status).json({ message: error.message });

    source.supersededByMemory = targetId;
    source.status = "superseded";
    await source.save();

    return res.status(200).json({
      edge: {
        source: String(id),
        target: String(targetId),
        type: "supersededBy",
      },
      status: "superseded",
    });
  } catch (error) {
    console.error("Error superseding decision:", error);
    return res
      .status(500)
      .json({ message: "Server error superseding decision" });
  }
};

/**
 * Helper DFS to detect cycles in decision dependency graph
 */
function detectCycles(nodesMap, adjList) {
  const visited = new Set();
  const recStack = new Set();
  const cycles = [];

  function dfs(currId, path) {
    visited.add(currId);
    recStack.add(currId);
    path.push(currId);

    const neighbors = adjList.get(currId) || [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        dfs(neighborId, [...path]);
      } else if (recStack.has(neighborId)) {
        const cycleStartIndex = path.indexOf(neighborId);
        if (cycleStartIndex !== -1) {
          const cyclePath = path.slice(cycleStartIndex);
          cyclePath.push(neighborId);
          cycles.push(cyclePath);
        }
      }
    }

    recStack.delete(currId);
  }

  for (const nodeId of nodesMap.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId, []);
    }
  }

  return cycles;
}

/**
 * @desc    Get 2D decision dependency matrix for the current organization
 * @route   GET /api/decision-graph/matrix
 * @access  Private (knowledge:view)
 */
export const getDecisionDependencyMatrix = async (req, res) => {
  try {
    const orgId = req.user.organization;
    const { search, status } = req.query || {};

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    const filter = {
      organization: orgId,
      lifecycleState: { $ne: "expired" },
    };

    if (
      status &&
      ["open", "in-progress", "resolved", "superseded"].includes(status)
    ) {
      filter.status = status;
    }

    if (search && typeof search === "string" && search.trim()) {
      const escapedSearch = escapeRegex(search.trim());
      filter.text = { $regex: escapedSearch, $options: "i" };
    }

    const decisions = await Decision.find(filter)
      .select(
        "text owner status importanceScore relatesTo supersededByMemory createdAt",
      )
      .sort({ importanceScore: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const decisionMap = new Map();
    const adjList = new Map();
    const inDegreeMap = new Map();
    const outDegreeMap = new Map();

    decisions.forEach((d) => {
      const idStr = d._id.toString();
      decisionMap.set(idStr, d);
      adjList.set(idStr, []);
      inDegreeMap.set(idStr, 0);
      outDegreeMap.set(idStr, 0);
    });

    let totalEdgeCount = 0;

    decisions.forEach((d) => {
      const sourceId = d._id.toString();

      if (Array.isArray(d.relatesTo)) {
        d.relatesTo.forEach((rel) => {
          const targetId = rel.target?.toString();
          if (targetId && decisionMap.has(targetId)) {
            adjList.get(sourceId).push(targetId);
            outDegreeMap.set(sourceId, (outDegreeMap.get(sourceId) || 0) + 1);
            inDegreeMap.set(targetId, (inDegreeMap.get(targetId) || 0) + 1);
            totalEdgeCount++;
          }
        });
      }

      if (d.supersededByMemory) {
        const targetId = d.supersededByMemory.toString();
        if (decisionMap.has(targetId)) {
          adjList.get(sourceId).push(targetId);
          outDegreeMap.set(sourceId, (outDegreeMap.get(sourceId) || 0) + 1);
          inDegreeMap.set(targetId, (inDegreeMap.get(targetId) || 0) + 1);
          totalEdgeCount++;
        }
      }
    });

    // Detect cycles
    const rawCycles = detectCycles(decisionMap, adjList);
    const cycleNodesSet = new Set(rawCycles.flat());

    const nodes = decisions.map((d) => {
      const idStr = d._id.toString();
      return {
        id: idStr,
        label: d.text,
        owner: d.owner || "Unassigned",
        status: d.status || "open",
        importanceScore: d.importanceScore || 0,
        inDegree: inDegreeMap.get(idStr) || 0,
        outDegree: outDegreeMap.get(idStr) || 0,
        inCycle: cycleNodesSet.has(idStr),
      };
    });

    // Build 2D relationship matrix grid
    const matrix = nodes.map((rowNode) => {
      const rowDecision = decisionMap.get(rowNode.id);

      return nodes.map((colNode) => {
        if (rowNode.id === colNode.id) {
          return { type: "self", confidence: null };
        }

        const relatesMatch = (rowDecision.relatesTo || []).find(
          (rel) => rel.target?.toString() === colNode.id,
        );

        if (relatesMatch) {
          return {
            type: "relatesTo",
            confidence: relatesMatch.confidence || 100,
          };
        }

        if (rowDecision.supersededByMemory?.toString() === colNode.id) {
          return {
            type: "supersededBy",
            confidence: 100,
          };
        }

        return { type: "none", confidence: null };
      });
    });

    const totalPossibleEdges =
      nodes.length > 1 ? nodes.length * (nodes.length - 1) : 0;
    const matrixDensity =
      totalPossibleEdges > 0
        ? Math.round((totalEdgeCount / totalPossibleEdges) * 100)
        : 0;

    return res.status(200).json({
      nodes,
      matrix,
      summary: {
        totalDecisions: nodes.length,
        totalDependencies: totalEdgeCount,
        matrixDensityPercentage: matrixDensity,
        cyclesCount: rawCycles.length,
      },
      cycles: rawCycles.map((cyclePath) =>
        cyclePath.map((nodeId) => decisionMap.get(nodeId)?.text || nodeId),
      ),
    });
  } catch (error) {
    console.error("Error generating decision dependency matrix:", error);
    return res
      .status(500)
      .json({ message: "Server error generating decision dependency matrix" });
  }
};
