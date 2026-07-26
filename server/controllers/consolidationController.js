import AuditLog from "../models/auditLogModel.js";
import {
  consolidateMemories,
  getConsolidatedMemories,
  MODEL_REGISTRY,
} from "../services/memoryConsolidationService.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

const VALID_MODEL_TYPES = Object.keys(MODEL_REGISTRY);

function parseModelsParam(rawModels) {
  if (!rawModels) return VALID_MODEL_TYPES;
  const requested = Array.isArray(rawModels)
    ? rawModels
    : String(rawModels)
        .split(",")
        .map((m) => m.trim());
  return requested.filter(Boolean);
}

/**
 * POST /api/knowledge/consolidate
 * Runs the Memory Consolidation Engine for the caller's organization.
 * Defaults to a dry run so admins can preview merges before committing;
 * pass `{ "dryRun": false }` to actually persist the consolidation.
 */
export const runConsolidation = async (req, res) => {
  try {
    const organization = req.user.organization || null;
    const {
      dryRun = true,
      models,
      embeddingThreshold,
      textThreshold,
    } = req.body || {};

    const modelTypes = parseModelsParam(models);
    const invalid = modelTypes.filter((m) => !VALID_MODEL_TYPES.includes(m));
    if (invalid.length || modelTypes.length === 0) {
      return sendError(
        res,
        400,
        `Invalid memory type(s): ${invalid.join(", ") || "none provided"}. Expected one or more of: ${VALID_MODEL_TYPES.join(", ")}`,
      );
    }

    if (
      embeddingThreshold !== undefined &&
      (typeof embeddingThreshold !== "number" ||
        embeddingThreshold < 0 ||
        embeddingThreshold > 1)
    ) {
      return sendError(
        res,
        400,
        "embeddingThreshold must be a number between 0 and 1",
      );
    }

    if (
      textThreshold !== undefined &&
      (typeof textThreshold !== "number" ||
        textThreshold < 0 ||
        textThreshold > 1)
    ) {
      return sendError(
        res,
        400,
        "textThreshold must be a number between 0 and 1",
      );
    }

    const report = await consolidateMemories({
      organization,
      dryRun: dryRun !== false,
      models: modelTypes,
      ...(embeddingThreshold !== undefined ? { embeddingThreshold } : {}),
      ...(textThreshold !== undefined ? { textThreshold } : {}),
    });

    // Only log an audit trail entry for consolidations that actually
    // wrote changes — dry runs are just previews.
    if (!report.dryRun && organization) {
      await AuditLog.create({
        organization,
        actor: req.user._id,
        action: "memory_consolidation",
        entity: "KnowledgeGraph",
        entityId: req.user._id,
        details: {
          modelTypes,
          totalClustersFound: report.totalClustersFound,
          totalMerged: report.totalMerged,
        },
      });
    }

    sendSuccess(res, { report });
  } catch (error) {
    console.error("runConsolidation error:", error);
    sendError(res, 500, "Failed to run memory consolidation");
  }
};

/**
 * GET /api/knowledge/consolidation/history?model=decision&limit=50
 * Returns canonical memories that resulted from a consolidation merge,
 * including their aliases and merge history, for review.
 */
export const getConsolidationHistory = async (req, res) => {
  try {
    const organization = req.user.organization || null;
    const { model = "decision", limit = 50 } = req.query;

    if (!VALID_MODEL_TYPES.includes(model)) {
      return sendError(
        res,
        400,
        `Invalid memory type "${model}". Expected one of: ${VALID_MODEL_TYPES.join(", ")}`,
      );
    }

    const parsedLimit = Number(limit);
    const safeLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;

    const memories = await getConsolidatedMemories(model, {
      organization,
      limit: safeLimit,
    });

    sendSuccess(res, {
      model,
      count: memories.length,
      memories,
    });
  } catch (error) {
    console.error("getConsolidationHistory error:", error);
    sendError(res, 500, "Failed to fetch consolidation history");
  }
};
