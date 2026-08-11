import Decision from "../models/decisionModel.js";

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
      // regex (ReDoS / regex injection), matching tagController's escaping.
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
