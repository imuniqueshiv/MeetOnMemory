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
import { sendSuccess, sendError } from "../utils/responseHandler.js";
import {
  recalculateImportanceQueue,
  memoryLifecycleQueue,
} from "../services/queueService.js";
import {
  runLifecycleSweep,
  restoreMemory,
  transitionLifecycleState,
} from "../services/memoryLifecycleService.js";
import AuditLog from "../models/auditLogModel.js";
import eventBus from "../services/eventBus.js";

const ALLOWED_SORT_FIELDS = {
  importance: { importanceScore: -1 },
  createdAt: { createdAt: -1 },
  dueDate: { dueDate: 1 },
};

/**
 * Ensures an organization value is either a string primitive or an ObjectId,
 * preventing object-injection payloads in organization query filters.
 */
const sanitizeOrg = (org) => {
  if (!org) return null;
  if (typeof org === "string") return String(org);
  if (org instanceof mongoose.Types.ObjectId) return org;
  if (typeof org === "object" && org._id) return sanitizeOrg(org._id);
  return String(org);
};

export const getDecisionLineageController = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = sanitizeOrg(req.user?.organization);

    if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Invalid decision id");
    }

    const cleanId = new mongoose.Types.ObjectId(id);

    // Verify the requested decision belongs to the user's organization
    const startDecision =
      await Decision.findById(cleanId).select("organization");

    if (
      !startDecision ||
      startDecision.organization?.toString() !== organization?.toString()
    ) {
      return sendError(res, 404, "Decision not found");
    }

    const chain = await getDecisionLineage(cleanId.toString());

    // Keep organization filtering as an additional safeguard
    const filteredChain = chain.filter(
      (decision) =>
        decision.organization?.toString() === organization?.toString(),
    );

    // Viewing a decision's lineage counts as accessing that memory; refresh
    // its importance score in the background so it doesn't block the response.
    recordMemoryAccess("decision", cleanId.toString());

    sendSuccess(res, { lineage: filteredChain });
  } catch (error) {
    console.error("getDecisionLineage error:", error);
    sendError(res, 500, "Failed to fetch decision lineage");
  }
};

export const getOpenActionItems = async (req, res) => {
  try {
    const {
      status = "open",
      sortBy = "createdAt",
      includeArchived,
      lifecycleState,
      search,
    } = req.query || {};
    const organization = sanitizeOrg(req.user?.organization);

    const allowedStatuses = [
      "open",
      "in-progress",
      "resolved",
      "superseded",
      "all",
    ];

    if (typeof status !== "string" || !allowedStatuses.includes(status)) {
      return sendError(res, 400, "Invalid status");
    }

    if (
      typeof sortBy !== "string" ||
      !Object.prototype.hasOwnProperty.call(ALLOWED_SORT_FIELDS, sortBy)
    ) {
      return sendError(
        res,
        400,
        `Invalid sortBy. Allowed values: ${Object.keys(ALLOWED_SORT_FIELDS).join(", ")}`,
      );
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

    if (search && typeof search === "string") {
      query = query.where({ text: { $regex: search, $options: "i" } });
    }

    if (
      lifecycleState &&
      ["active", "dormant", "archived", "expired"].includes(lifecycleState)
    ) {
      query = query.where({ lifecycleState });
    } else if (includeArchived !== "true") {
      query = query.where({
        lifecycleState: { $nin: ["archived", "expired"] },
      });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const skip = (page - 1) * limit;

    const total =
      typeof ActionItem.countDocuments === "function" &&
      typeof query.getFilter === "function"
        ? await ActionItem.countDocuments(query.getFilter())
        : 0;

    let itemsQuery = query
      .populate("sourceMeetingId", "title date")
      .sort(ALLOWED_SORT_FIELDS[sortBy]);

    if (typeof itemsQuery.skip === "function") {
      itemsQuery = itemsQuery.skip(skip).limit(limit);
    }

    const items = await itemsQuery;

    // Retrieving this list counts as accessing each memory in it; refresh
    // their importance scores in the background without blocking the response.
    recordMemoryAccessBatch(
      "actionItem",
      items.map((item) => item._id),
    );

    sendSuccess(res, {
      actionItems: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getOpenActionItems error:", error);
    sendError(res, 500, "Failed to fetch action items");
  }
};

export const getDecisions = async (req, res) => {
  try {
    const {
      status,
      sortBy = "createdAt",
      includeArchived,
      lifecycleState,
      search,
    } = req.query || {};
    const organization = sanitizeOrg(req.user?.organization);

    const allowedStatuses = ["open", "in-progress", "resolved", "superseded"];

    if (status !== undefined && status !== null) {
      if (typeof status !== "string" || !allowedStatuses.includes(status)) {
        return sendError(res, 400, "Invalid status");
      }
    }

    if (
      typeof sortBy !== "string" ||
      !Object.prototype.hasOwnProperty.call(ALLOWED_SORT_FIELDS, sortBy)
    ) {
      return sendError(
        res,
        400,
        `Invalid sortBy. Allowed values: ${Object.keys(ALLOWED_SORT_FIELDS).join(", ")}`,
      );
    }

    const filter = { organization };
    if (status === "open") {
      filter.status = "open";
    } else if (status === "in-progress") {
      filter.status = "in-progress";
    } else if (status === "resolved") {
      filter.status = "resolved";
    } else if (status === "superseded") {
      filter.status = "superseded";
    }

    if (search && typeof search === "string") {
      filter.text = { $regex: search, $options: "i" };
    }

    if (
      lifecycleState &&
      ["active", "dormant", "archived", "expired"].includes(lifecycleState)
    ) {
      filter.lifecycleState = lifecycleState;
    } else if (includeArchived !== "true") {
      filter.lifecycleState = { $nin: ["archived", "expired"] };
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const skip = (page - 1) * limit;

    const total =
      typeof Decision.countDocuments === "function"
        ? await Decision.countDocuments(filter)
        : 0;

    const sort =
      sortBy === "dueDate" ? { createdAt: -1 } : ALLOWED_SORT_FIELDS[sortBy];

    let decisionsQuery = Decision.find(filter)
      .populate("sourceMeetingId", "title date")
      .sort(sort);

    if (typeof decisionsQuery.skip === "function") {
      decisionsQuery = decisionsQuery.skip(skip).limit(limit);
    }

    const decisions = await decisionsQuery;

    recordMemoryAccessBatch(
      "decision",
      decisions.map((d) => d._id),
    );

    sendSuccess(res, {
      decisions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getDecisions error:", error);
    sendError(res, 500, "Failed to fetch decisions");
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
    const organization = sanitizeOrg(req.user?.organization);

    if (
      typeof type !== "string" ||
      !["decision", "action-item"].includes(type)
    ) {
      return sendError(
        res,
        400,
        "Invalid memory type. Use 'decision' or 'action-item'.",
      );
    }

    if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Invalid memory id");
    }

    const safeType = type === "decision" ? "decision" : "action-item";
    const Model = safeType === "decision" ? Decision : ActionItem;
    const cleanId = new mongoose.Types.ObjectId(id);
    const existing = await Model.findById(cleanId).select("organization");

    if (
      !existing ||
      existing.organization?.toString() !== organization?.toString()
    ) {
      return sendError(res, 404, "Memory not found");
    }

    const updated = await recordMemoryFeedback(
      safeType === "decision" ? "decision" : "actionItem",
      cleanId.toString(),
      rating,
    );

    sendSuccess(res, {
      importanceScore: updated.importanceScore,
      importanceFactors: updated.importanceFactors,
    });
  } catch (error) {
    console.error("submitMemoryFeedback error:", error);
    const status = error.message?.includes("between 1 and 5") ? 400 : 500;
    sendError(res, status, error.message || "Failed to record feedback");
  }
};

/**
 * Manually triggers a full importance-score recalculation for every memory
 * in the caller's organization. Intended for admins/moderators, or to be
 * wired up to a scheduled job later.
 */
export const recalculateImportance = async (req, res) => {
  try {
    const organization = sanitizeOrg(req.user?.organization);

    if (recalculateImportanceQueue.isActive) {
      await recalculateImportanceQueue.add("recalculate-importance", {
        organization,
      });
      return sendSuccess(
        res,
        {},
        "Importance scores recalculation started in the background",
        202,
      );
    }

    // Fallback to synchronous execution when Redis is not configured (e.g. testing / development)
    const results = await recalculateAllImportanceScores({ organization });

    sendSuccess(res, { ...results }, "Importance scores recalculated");
  } catch (error) {
    console.error("recalculateImportance error:", error);
    sendError(res, 500, "Failed to recalculate importance scores");
  }
};

export const updateActionItemStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const organization = sanitizeOrg(req.user?.organization);

    if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Invalid action item id");
    }

    const allowedStatuses = ["open", "in-progress", "resolved", "superseded"];

    if (typeof status !== "string" || !allowedStatuses.includes(status)) {
      return sendError(res, 400, "Invalid status");
    }

    let safeStatus;
    if (status === "open") safeStatus = "open";
    else if (status === "in-progress") safeStatus = "in-progress";
    else if (status === "resolved") safeStatus = "resolved";
    else if (status === "superseded") safeStatus = "superseded";

    const cleanId = new mongoose.Types.ObjectId(id);

    // Fetch first to satisfy CodeQL
    const item = await ActionItem.findOne({
      _id: cleanId,
      organization,
    });

    if (!item) {
      return sendError(res, 404, "Action item not found");
    }

    item.status = safeStatus;
    item.resolvedAt = safeStatus === "resolved" ? new Date() : null;

    await item.save();

    if (safeStatus === "resolved" && req.user?.id) {
      eventBus.emit("actionItem.completed", {
        userId: req.user.id,
        organizationId: item.organization,
        actionItemId: item._id,
      });
    }

    sendSuccess(res, { actionItem: item });
  } catch (error) {
    console.error("updateActionItemStatus error:", error);
    sendError(res, 500, "Failed to update action item");
  }
};

export const toggleActionItemReminderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const organization = sanitizeOrg(req.user?.organization);

    if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Invalid action item id");
    }

    const cleanId = new mongoose.Types.ObjectId(id);
    const item = await ActionItem.findOne({
      _id: cleanId,
      organization,
    });

    if (!item) {
      return sendError(res, 404, "Action item not found");
    }

    item.remindersEnabled =
      enabled !== undefined ? Boolean(enabled) : !item.remindersEnabled;
    await item.save();

    sendSuccess(res, { actionItem: item });
  } catch (error) {
    console.error("toggleActionItemReminderStatus error:", error);
    sendError(res, 500, "Failed to toggle action item reminder");
  }
};

/**
 * POST /api/knowledge/lifecycle/run
 * Manually triggers a full lifecycle sweep (active/dormant/archived/expired
 * classification) for the caller's organization. Also runs automatically
 * on a schedule once Redis/BullMQ is configured (see queueService.js).
 */
export const runMemoryLifecycleSweep = async (req, res) => {
  try {
    const organization = sanitizeOrg(req.user?.organization);

    if (memoryLifecycleQueue.isActive) {
      await memoryLifecycleQueue.add("memory-lifecycle-sweep", {
        organization,
      });
      return sendSuccess(
        res,
        {},
        "Memory lifecycle sweep started in the background",
        202,
      );
    }

    // Fallback to synchronous execution when Redis is not configured (e.g.
    // testing / development), same pattern as recalculateImportance above.
    const summary = await runLifecycleSweep({ organization });

    if (organization) {
      await AuditLog.create({
        organization,
        actor: req.user._id,
        action: "memory_lifecycle_sweep",
        entity: "KnowledgeGraph",
        entityId: req.user._id,
        details: summary,
      });
    }

    sendSuccess(res, { summary }, "Memory lifecycle sweep completed");
  } catch (error) {
    console.error("runMemoryLifecycleSweep error:", error);
    sendError(res, 500, "Failed to run memory lifecycle sweep");
  }
};

/**
 * PATCH /api/knowledge/:type/:id/lifecycle
 * Manually moves a memory to a specific lifecycle state (e.g. an admin
 * archiving something early, or restoring an archived memory).
 */
export const updateMemoryLifecycleState = async (req, res) => {
  try {
    const { type, id } = req.params;
    const { state, reason } = req.body || {};
    const organization = sanitizeOrg(req.user?.organization);

    if (
      typeof type !== "string" ||
      !["decision", "action-item"].includes(type)
    ) {
      return sendError(
        res,
        400,
        "Invalid memory type. Use 'decision' or 'action-item'.",
      );
    }

    if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Invalid memory id");
    }

    const allowedStates = ["active", "dormant", "archived", "expired"];
    if (typeof state !== "string" || !allowedStates.includes(state)) {
      return sendError(
        res,
        400,
        `Invalid state. Expected one of: ${allowedStates.join(", ")}`,
      );
    }

    const safeType = type === "decision" ? "decision" : "actionItem";
    const Model = safeType === "decision" ? Decision : ActionItem;
    const cleanId = new mongoose.Types.ObjectId(id);

    const document = await Model.findOne({ _id: cleanId, organization });
    if (!document) {
      return sendError(res, 404, "Memory not found");
    }

    const updated =
      state === "active"
        ? await restoreMemory(safeType, cleanId, {
            triggeredBy: req.user?._id?.toString() || "admin",
            reason: reason || "Manually restored",
          })
        : await transitionLifecycleState(document, state, {
            triggeredBy: req.user?._id?.toString() || "admin",
            reason: reason || "Manually updated by admin",
          });

    if (organization) {
      await AuditLog.create({
        organization,
        actor: req.user._id,
        action: "memory_lifecycle_transition",
        entity: safeType === "decision" ? "Decision" : "ActionItem",
        entityId: cleanId,
        details: { toState: state, reason },
      });
    }

    sendSuccess(res, {
      lifecycleState: updated.lifecycleState,
      lifecycleHistory: updated.lifecycleHistory,
    });
  } catch (error) {
    console.error("updateMemoryLifecycleState error:", error);
    sendError(res, 500, "Failed to update memory lifecycle state");
  }
};
