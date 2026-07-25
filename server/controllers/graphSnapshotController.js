import mongoose from "mongoose";
import {
  captureSnapshot,
  listSnapshots,
  getSnapshotById,
  diffSnapshots,
} from "../services/graphSnapshotService.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * GET /api/knowledge/graph/snapshots?limit=50&before=<ISO date>
 * Timeline listing (metadata only, no node/edge payload).
 */
export const getSnapshots = async (req, res) => {
  try {
    const organization = req.user.organization || null;
    const { limit, before } = req.query;

    const snapshots = await listSnapshots(organization, { limit, before });

    sendSuccess(res, {
      count: snapshots.length,
      snapshots,
    });
  } catch (error) {
    console.error("getSnapshots error:", error);
    sendError(res, 500, "Failed to fetch graph snapshots");
  }
};

/**
 * GET /api/knowledge/graph/snapshots/:id
 * Full snapshot (nodes + edges) for rendering a historical graph.
 */
export const getSnapshot = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid snapshot ID");
    }

    const organization = req.user.organization || null;
    const snapshot = await getSnapshotById(id, organization);

    if (!snapshot) {
      return sendError(res, 404, "Snapshot not found");
    }

    sendSuccess(res, { snapshot });
  } catch (error) {
    console.error("getSnapshot error:", error);
    sendError(res, 500, "Failed to fetch graph snapshot");
  }
};

/**
 * GET /api/knowledge/graph/snapshots/:id/export
 * Same payload as getSnapshot, but intended for download/audit tooling
 * (content-disposition hints the client to save rather than render).
 */
export const exportSnapshot = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid snapshot ID");
    }

    const organization = req.user.organization || null;
    const snapshot = await getSnapshotById(id, organization);

    if (!snapshot) {
      return sendError(res, 404, "Snapshot not found");
    }

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="graph-snapshot-${id}.json"`,
    );
    sendSuccess(res, { snapshot });
  } catch (error) {
    console.error("exportSnapshot error:", error);
    sendError(res, 500, "Failed to export graph snapshot");
  }
};

/**
 * GET /api/knowledge/graph/snapshots/diff?from=<id>&to=<id>
 * Node/edge-level diff between any two snapshots for the caller's org.
 */
export const getSnapshotDiff = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return sendError(
        res,
        400,
        "Both 'from' and 'to' snapshot IDs are required",
      );
    }
    if (!isValidObjectId(from) || !isValidObjectId(to)) {
      return sendError(res, 400, "Invalid snapshot ID(s)");
    }

    const organization = req.user.organization || null;
    const diff = await diffSnapshots(from, to, organization);

    sendSuccess(res, { diff });
  } catch (error) {
    console.error("getSnapshotDiff error:", error);
    const notFound = /not found/i.test(error.message);
    sendError(
      res,
      notFound ? 404 : 500,
      notFound ? error.message : "Failed to compute graph snapshot diff",
    );
  }
};

/**
 * POST /api/knowledge/graph/snapshots
 * Manually triggers a snapshot capture (e.g. before/after a bulk edit).
 * Skips writing a duplicate if nothing has changed since the last capture,
 * unless { "force": true } is passed.
 */
export const createManualSnapshot = async (req, res) => {
  try {
    const organization = req.user.organization || null;
    const { force = false } = req.body || {};

    const result = await captureSnapshot(organization, {
      trigger: "manual",
      triggeredBy: req.user._id,
      force: Boolean(force),
    });

    if (result.skipped) {
      return sendSuccess(
        res,
        { skipped: true },
        "No graph changes since the last snapshot; nothing captured.",
      );
    }

    sendSuccess(
      res,
      { skipped: false, snapshot: result.snapshot },
      "Success",
      201,
    );
  } catch (error) {
    console.error("createManualSnapshot error:", error);
    sendError(res, 500, "Failed to create graph snapshot");
  }
};
