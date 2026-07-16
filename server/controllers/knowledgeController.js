import mongoose from "mongoose";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
import { getDecisionLineage } from "../services/knowledgeGraphService.js";
import {
  recalculateAllImportanceScores,
  recordMemoryAccess,
  recordMemoryAccessBatch,
  recordMemoryFeedback,
} from "../services/importanceScoringService.js";

const ALLOWED_SORT_FIELDS = {
  importance: { importanceScore: -1 },
  createdAt: { createdAt: -1 },
  dueDate: { dueDate: 1 },
};

export const getDecisionLineageController = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = req.user.organization || null;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid decision id",
      });
    }

    // Verify the requested decision belongs to the user's organization
    const startDecision = await Decision.findById(id).select("organization");

    if (
      !startDecision ||
      startDecision.organization?.toString() !== organization?.toString()
    ) {
      return res.status(404).json({
        success: false,
        message: "Decision not found",
      });
    }

    const chain = await getDecisionLineage(id);

    // Keep organization filtering as an additional safeguard
    const filteredChain = chain.filter(
      (decision) =>
        decision.organization?.toString() === organization?.toString(),
    );

    // Viewing a decision's lineage counts as accessing that memory; refresh
    // its importance score in the background so it doesn't block the response.
    recordMemoryAccess("decision", id);

    res.status(200).json({
      success: true,
      lineage: filteredChain,
    });
  } catch (error) {
    console.error("getDecisionLineage error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch decision lineage",
    });
  }
};

export const getOpenActionItems = async (req, res) => {
  try {
    const { status = "open", sortBy = "createdAt" } = req.query;
    const organization = req.user.organization;

    if (!Object.prototype.hasOwnProperty.call(ALLOWED_SORT_FIELDS, sortBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sortBy. Allowed values: ${Object.keys(ALLOWED_SORT_FIELDS).join(", ")}`,
      });
    }

    const allowedStatuses = [
      "open",
      "in-progress",
      "resolved",
      "superseded",
      "all",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    let query;
    if (status === "all") {
      query = ActionItem.find({ organization });
    } else if (status === "open") {
      query = ActionItem.find({
        organization,
        status: "open",
      });
    } else if (status === "in-progress") {
      query = ActionItem.find({
        organization,
        status: "in-progress",
      });
    } else if (status === "resolved") {
      query = ActionItem.find({
        organization,
        status: "resolved",
      });
    } else if (status === "superseded") {
      query = ActionItem.find({
        organization,
        status: "superseded",
      });
    }

    const items = await query
      .populate("sourceMeetingId", "title date")
      .sort(ALLOWED_SORT_FIELDS[sortBy]);

    // Retrieving this list counts as accessing each memory in it; refresh
    // their importance scores in the background without blocking the response.
    recordMemoryAccessBatch(
      "actionItem",
      items.map((item) => item._id),
    );

    res.status(200).json({
      success: true,
      actionItems: items,
    });
  } catch (error) {
    console.error("getOpenActionItems error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch action items",
    });
  }
};

export const getDecisions = async (req, res) => {
  try {
    const { status, sortBy = "createdAt" } = req.query;
    const organization = req.user.organization;

    if (!Object.prototype.hasOwnProperty.call(ALLOWED_SORT_FIELDS, sortBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sortBy. Allowed values: ${Object.keys(ALLOWED_SORT_FIELDS).join(", ")}`,
      });
    }

    const allowedStatuses = ["open", "in-progress", "resolved", "superseded"];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const filter = { organization };
    if (status) filter.status = status;

    const sort =
      sortBy === "dueDate" ? { createdAt: -1 } : ALLOWED_SORT_FIELDS[sortBy];

    const decisions = await Decision.find(filter)
      .populate("sourceMeetingId", "title date")
      .sort(sort);

    recordMemoryAccessBatch(
      "decision",
      decisions.map((d) => d._id),
    );

    res.status(200).json({
      success: true,
      decisions,
    });
  } catch (error) {
    console.error("getDecisions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch decisions",
    });
  }
};

/**
 * Records explicit user feedback (1-5 rating) on how useful a memory
 * (decision or action item) was, feeding the "User Feedback" scoring
 * factor.
 */
export const submitMemoryFeedback = async (req, res) => {
  try {
    const { type, id } = req.params;
    const { rating } = req.body;
    const organization = req.user.organization || null;

    if (!["decision", "action-item"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memory type. Use 'decision' or 'action-item'.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memory id",
      });
    }

    const Model = type === "decision" ? Decision : ActionItem;
    const existing = await Model.findById(id).select("organization");

    if (
      !existing ||
      existing.organization?.toString() !== organization?.toString()
    ) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      });
    }

    const updated = await recordMemoryFeedback(
      type === "decision" ? "decision" : "actionItem",
      id,
      rating,
    );

    res.status(200).json({
      success: true,
      importanceScore: updated.importanceScore,
      importanceFactors: updated.importanceFactors,
    });
  } catch (error) {
    console.error("submitMemoryFeedback error:", error);
    const status = error.message?.includes("between 1 and 5") ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error.message || "Failed to record feedback",
    });
  }
};

/**
 * Manually triggers a full importance-score recalculation for every memory
 * in the caller's organization. Intended for admins/moderators, or to be
 * wired up to a scheduled job later.
 */
export const recalculateImportance = async (req, res) => {
  try {
    const organization = req.user.organization || null;
    const results = await recalculateAllImportanceScores({ organization });

    res.status(200).json({
      success: true,
      message: "Importance scores recalculated",
      ...results,
    });
  } catch (error) {
    console.error("recalculateImportance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to recalculate importance scores",
    });
  }
};

export const updateActionItemStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const organization = req.user.organization;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action item id",
      });
    }

    const allowedStatuses = ["open", "in-progress", "resolved", "superseded"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Fetch first to satisfy CodeQL
    const item = await ActionItem.findOne({
      _id: id,
      organization,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Action item not found",
      });
    }

    item.status = status;
    item.resolvedAt = status === "resolved" ? new Date() : null;

    await item.save();

    res.status(200).json({
      success: true,
      actionItem: item,
    });
  } catch (error) {
    console.error("updateActionItemStatus error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update action item",
    });
  }
};
