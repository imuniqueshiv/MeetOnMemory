import mongoose from "mongoose";
import ActionItem from "../models/actionItemModel.js";
import Decision from "../models/decisionModel.js";
import Meeting from "../models/meetingModel.js";
import Organization from "../models/organizationModel.js";
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
import {
  ALLOWED_ARCHIVE_TYPES,
  getArchivedMemoriesPage,
} from "../services/archivedKnowledgeService.js";
import AuditLog from "../models/auditLogModel.js";
import eventBus from "../services/eventBus.js";
import { buildPaginationMeta, parsePagination } from "../utils/pagination.js";
import { escapeRegExp } from "../utils/regexUtils.js";

const ALLOWED_SORT_FIELDS = {
  importance: { importanceScore: -1 },
  createdAt: { createdAt: -1 },
  dueDate: { dueDate: 1 },
};

/** Sort keys accepted by the Tasks board / action-items list (#903). */
const ACTION_ITEM_SORT_FIELDS = new Set([
  "dueDate",
  "createdDate",
  "createdAt",
  "importance",
  "alphabetical",
  "status",
  "priority",
]);

const STATUS_WEIGHT = {
  open: 0,
  "in-progress": 1,
  resolved: 2,
  superseded: 3,
};

const MEETING_POPULATE = {
  path: "sourceMeetingId",
  select: "title date organization",
  populate: { path: "organization", select: "name" },
};

const resolveActionItemSort = (sortBy, sortOrder) => {
  const direction = sortOrder === "desc" ? -1 : 1;

  switch (sortBy) {
    case "dueDate":
      return { dueDate: direction, createdAt: -1 };
    case "createdDate":
    case "createdAt":
      return { createdAt: direction };
    case "importance":
      return { importanceScore: direction, createdAt: -1 };
    case "alphabetical":
      return { text: direction, createdAt: -1 };
    case "priority":
      // Priority is not persisted on ActionItem; keep a stable secondary order.
      return { createdAt: direction };
    default:
      return { createdAt: direction };
  }
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
      sortOrder = "desc",
      includeArchived,
      lifecycleState,
      search,
      owner,
      priority,
      organization: organizationName,
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

    if (typeof sortBy !== "string" || !ACTION_ITEM_SORT_FIELDS.has(sortBy)) {
      return sendError(
        res,
        400,
        `Invalid sortBy. Allowed values: ${[...ACTION_ITEM_SORT_FIELDS].join(", ")}`,
      );
    }

    if (
      sortOrder !== undefined &&
      sortOrder !== null &&
      sortOrder !== "" &&
      sortOrder !== "asc" &&
      sortOrder !== "desc"
    ) {
      return sendError(
        res,
        400,
        "Invalid sortOrder. Allowed values: asc, desc",
      );
    }

    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    // Preserve legacy defaults when sortOrder is omitted (dueDate asc, others desc).
    const effectiveSortOrder =
      sortOrder === "asc" || sortOrder === "desc"
        ? sortOrder
        : sortBy === "dueDate"
          ? "asc"
          : "desc";

    const filter = {};
    if (organization) {
      filter.organization = mongoose.Types.ObjectId.isValid(organization)
        ? new mongoose.Types.ObjectId(organization)
        : organization;
    }

    if (status !== "all") {
      filter.status = status;
    }

    if (typeof owner === "string" && owner && owner !== "all") {
      filter.owner = owner;
    }

    // Priority is not a persisted ActionItem field. Preserve prior client UX:
    // "medium" matches everything (default), high/low match nothing.
    if (priority === "high" || priority === "low") {
      filter.priority = priority;
    }

    if (
      typeof organizationName === "string" &&
      organizationName &&
      organizationName !== "all"
    ) {
      if (organizationName === "Personal") {
        filter.organization = null;
      } else {
        const orgDoc = await Organization.findOne({
          name: organizationName,
        })
          .select("_id")
          .lean();
        if (!orgDoc) {
          return sendSuccess(res, {
            actionItems: [],
            pagination: buildPaginationMeta({ total: 0, page, limit }),
            facets: { owners: [], organizations: [] },
          });
        }
        filter.organization = orgDoc._id;
      }
    }

    if (
      lifecycleState &&
      ["active", "dormant", "archived", "expired"].includes(lifecycleState)
    ) {
      filter.lifecycleState = lifecycleState;
    } else if (includeArchived !== "true") {
      filter.lifecycleState = { $nin: ["archived", "expired"] };
    }

    const searchTerm =
      typeof search === "string" && search.trim() ? search.trim() : "";
    if (searchTerm) {
      const escaped = escapeRegExp(searchTerm);
      const meetingTitleFilter = {
        title: { $regex: escaped, $options: "i" },
      };
      if (filter.organization !== undefined) {
        meetingTitleFilter.organization = filter.organization;
      }

      const matchingMeetings = await Meeting.find(meetingTitleFilter)
        .select("_id")
        .lean();

      filter.$or = [
        { text: { $regex: escaped, $options: "i" } },
        { owner: { $regex: escaped, $options: "i" } },
        {
          sourceMeetingId: {
            $in: matchingMeetings.map((meeting) => meeting._id),
          },
        },
      ];
    }

    // Facets for filter dropdowns (scoped to org + lifecycle, not page-local)
    const facetFilter = {
      ...(organization ? { organization } : {}),
      ...(filter.lifecycleState
        ? { lifecycleState: filter.lifecycleState }
        : {}),
    };
    if (status !== "all") {
      facetFilter.status = status;
    }

    const [total, ownerFacets, organizationIds, hasPersonal] =
      await Promise.all([
        ActionItem.countDocuments(filter),
        ActionItem.distinct("owner", facetFilter),
        ActionItem.distinct("organization", {
          ...facetFilter,
          organization: { $ne: null },
        }),
        ActionItem.exists({ ...facetFilter, organization: null }),
      ]);

    let organizationFacets = [];
    if (organizationIds.length > 0) {
      const orgs = await Organization.find({
        _id: { $in: organizationIds.filter(Boolean) },
      })
        .select("name")
        .lean();
      organizationFacets = orgs.map((org) => org.name).filter(Boolean);
    }
    if (hasPersonal) {
      organizationFacets.push("Personal");
    }
    organizationFacets = [...new Set(organizationFacets)].sort((a, b) =>
      a.localeCompare(b),
    );

    const direction = effectiveSortOrder === "desc" ? -1 : 1;
    let items;

    if (sortBy === "status") {
      // Semantic status order (open → in-progress → resolved → superseded)
      const pipeline = [
        { $match: filter },
        {
          $addFields: {
            statusWeight: {
              $switch: {
                branches: Object.entries(STATUS_WEIGHT).map(
                  ([value, weight]) => ({
                    case: { $eq: ["$status", value] },
                    then: weight,
                  }),
                ),
                default: 0,
              },
            },
          },
        },
        { $sort: { statusWeight: direction, createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ];

      items = await ActionItem.aggregate(pipeline);
      items = await ActionItem.populate(items, MEETING_POPULATE);
    } else {
      items = await ActionItem.find(filter)
        .populate(MEETING_POPULATE)
        .sort(resolveActionItemSort(sortBy, effectiveSortOrder))
        .skip(skip)
        .limit(limit);
    }

    recordMemoryAccessBatch(
      "actionItem",
      items.map((item) => item._id),
    );

    sendSuccess(res, {
      actionItems: items,
      pagination: buildPaginationMeta({ total, page, limit }),
      facets: {
        owners: ownerFacets.filter(Boolean).sort((a, b) => a.localeCompare(b)),
        organizations: organizationFacets,
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
 * Unified Knowledge Archive listing (#901).
 *
 * The archive browser previously fetched page N of decisions and page N of
 * action items independently, then merged them on the client. That produced
 * the wrong page size, wrong totalPages (max of the two), and could skip or
 * duplicate records. This endpoint paginates the combined set once.
 */
export const getArchivedMemories = async (req, res) => {
  try {
    const { type = "all", search } = req.query || {};
    const organization = sanitizeOrg(req.user?.organization);

    if (!organization) {
      return sendError(res, 400, "Organization required");
    }

    if (typeof type !== "string" || !ALLOWED_ARCHIVE_TYPES.includes(type)) {
      return sendError(
        res,
        400,
        `Invalid type. Allowed values: ${ALLOWED_ARCHIVE_TYPES.join(", ")}`,
      );
    }

    if (search !== undefined && search !== null && typeof search !== "string") {
      return sendError(res, 400, "Invalid search");
    }

    const result = await getArchivedMemoriesPage({
      organization,
      type,
      search,
      page: req.query.page,
      limit: req.query.limit,
    });

    sendSuccess(res, result);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.statusCode, error.message);
    }
    console.error("getArchivedMemories error:", error);
    sendError(res, 500, "Failed to fetch archived memories");
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
