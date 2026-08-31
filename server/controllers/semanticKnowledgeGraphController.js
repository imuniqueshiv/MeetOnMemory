import Meeting from "../models/meetingModel.js";
import semanticKnowledgeGraphExtractionService from "../services/semanticKnowledgeGraphExtractionService.js";

/**
 * Controller handling semantic entity-relation extraction and k-hop neighborhood querying
 */

/**
 * Tenant scope for both endpoints (Issue #2446).
 *
 * These previously read `req.user?.organizationId || req.headers["x-organization-id"]`.
 * `userAuth` assigns the user document, which stores the org as `organization`,
 * so the session branch was always `undefined` and scope came from a header the
 * caller controls — or, when no header was sent, from nothing at all:
 * `getSemanticNeighborhood` then pooled meetings from every tenant into one
 * graph. `organizationId` was also not a field on the meeting schema
 * (`organization` is), so a request that *did* send the header matched no
 * documents. Tenant identity comes from `req.user` only (Issue #1068).
 */
const resolveOrganizationId = (req) =>
  req.user?.organization?._id || req.user?.organization || null;

const MISSING_ORGANIZATION_ERROR =
  "Organization context is required for semantic graph queries";

export const extractSemanticGraphFromMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const organizationId = resolveOrganizationId(req);

    if (!organizationId) {
      return res.status(400).json({ error: MISSING_ORGANIZATION_ERROR });
    }

    const meeting = await Meeting.findOne({
      _id: meetingId,
      organization: organizationId,
    })
      .populate("actionItems.assignee", "name email")
      .lean();

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    const graph =
      semanticKnowledgeGraphExtractionService.extractSemanticRelationships(
        meeting,
      );

    return res.status(200).json({ graph });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getSemanticNeighborhood = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const { seedNodeId, kHops = 1 } = req.query;

    if (!organizationId) {
      return res.status(400).json({ error: MISSING_ORGANIZATION_ERROR });
    }

    if (!seedNodeId) {
      return res
        .status(400)
        .json({ error: "seedNodeId query parameter is required" });
    }

    // Fetch recent meetings in organization to build the graph pool
    const meetings = await Meeting.find({
      organization: organizationId,
    })
      .limit(50)
      .populate("actionItems.assignee", "name email")
      .lean();

    let allNodes = [];
    let allEdges = [];

    for (const meeting of meetings) {
      const { nodes, edges } =
        semanticKnowledgeGraphExtractionService.extractSemanticRelationships(
          meeting,
        );
      allNodes.push(...nodes);
      allEdges.push(...edges);
    }

    // De-duplicate nodes
    const nodeMap = new Map();
    allNodes.forEach((n) => nodeMap.set(n.id, n));
    allNodes = Array.from(nodeMap.values());

    const neighborhood =
      semanticKnowledgeGraphExtractionService.expandNeighborhood(
        allNodes,
        allEdges,
        seedNodeId,
        parseInt(kHops, 10) || 1,
      );

    return res.status(200).json(neighborhood);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
