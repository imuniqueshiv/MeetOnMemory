import AuditLog from "../models/auditLogModel.js";
import AuditLogExport from "../models/auditLogExportModel.js";
import { dataExportQueue } from "../services/queueService.js";
import {
  AUDIT_EXPORT_DIRECTORY,
  buildAuditLogFilter,
  streamCsvExport,
  streamXlsxExport,
} from "../services/auditLogExportService.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";
import fs from "fs";
import path from "path";

const LARGE_EXPORT_THRESHOLD = 10000;
const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;

const parseFilters = (query, organizationId) => {
  const { action, startDate, endDate } = query;
  if (startDate && Number.isNaN(new Date(startDate).getTime())) {
    throw new Error("Invalid startDate.");
  }
  if (endDate && Number.isNaN(new Date(endDate).getTime())) {
    throw new Error("Invalid endDate.");
  }
  return buildAuditLogFilter({ organizationId, action, startDate, endDate });
};

/**
 * ✅ Get Audit Logs for an Organization (Admin/Owner only)
 * GET /api/organization/:id/audit-logs
 */
export const getOrganizationAuditLogs = async (req, res) => {
  try {
    const organizationId = req.params.id;
    const { format, page = 1, limit = 20 } = req.query;
    if (format && !["csv", "xlsx"].includes(format)) {
      return sendError(res, 400, "Export format must be csv or xlsx.");
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (
      !Number.isInteger(pageNum) ||
      pageNum < 1 ||
      !Number.isInteger(limitNum) ||
      limitNum < 1
    ) {
      return sendError(res, 400, "page and limit must be positive integers.");
    }
    const skip = (pageNum - 1) * limitNum;
    const filter = parseFilters(req.query, organizationId);

    if (format) {
      const total = await AuditLog.countDocuments(filter);
      const filename = `audit-logs-${organizationId}.${format}`;
      if (total > LARGE_EXPORT_THRESHOLD) {
        if (!dataExportQueue.isActive) {
          return sendError(
            res,
            503,
            "Background export processing is unavailable.",
          );
        }
        const exportRecord = await AuditLogExport.create({
          organization: organizationId,
          requestedBy: req.user.id || req.user._id,
          format,
          filters: {
            action: req.query.action || undefined,
            startDate: req.query.startDate || undefined,
            endDate: req.query.endDate || undefined,
          },
          expiresAt: new Date(Date.now() + EXPORT_TTL_MS),
        });
        await dataExportQueue.add("audit-log-export", {
          exportId: exportRecord._id.toString(),
        });
        return sendSuccess(
          res,
          {
            export: {
              id: exportRecord._id,
              status: exportRecord.status,
              statusUrl: `/api/organizations/${organizationId}/audit-log-exports/${exportRecord._id}`,
              downloadUrl: `/api/organizations/${organizationId}/audit-log-exports/${exportRecord._id}/download`,
            },
          },
          "Audit log export queued.",
          202,
        );
      }

      res.setHeader(
        "Content-Type",
        format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      if (format === "csv") return streamCsvExport(res, filter);
      return streamXlsxExport(res, filter);
    }

    // Execute query with pagination and populate the actor
    const logs = await AuditLog.find(filter)
      .populate("actor", "name email profilePic")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await AuditLog.countDocuments(filter);

    sendSuccess(res, {
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching audit logs:", error);
    sendError(res, 500, "Server error fetching audit logs.");
  }
};

export const getAuditLogExport = async (req, res) => {
  try {
    const exportRecord = await AuditLogExport.findOne({
      _id: req.params.exportId,
      organization: req.params.id,
    }).lean();
    if (!exportRecord)
      return sendError(res, 404, "Audit log export not found.");
    return sendSuccess(res, {
      export: {
        id: exportRecord._id,
        status: exportRecord.status,
        downloadUrl:
          exportRecord.status === "completed"
            ? `/api/organizations/${req.params.id}/audit-log-exports/${exportRecord._id}/download`
            : null,
        expiresAt: exportRecord.expiresAt,
        error:
          exportRecord.status === "failed" ? exportRecord.error : undefined,
      },
    });
  } catch (_error) {
    return sendError(res, 500, "Server error fetching audit log export.");
  }
};

export const downloadAuditLogExport = async (req, res) => {
  try {
    const exportRecord = await AuditLogExport.findOne({
      _id: req.params.exportId,
      organization: req.params.id,
      status: "completed",
    }).lean();
    if (!exportRecord)
      return sendError(res, 404, "Completed audit log export not found.");
    const filePath = path.join(
      AUDIT_EXPORT_DIRECTORY,
      exportRecord.fileName || "",
    );
    if (
      !exportRecord.fileName ||
      !filePath.startsWith(AUDIT_EXPORT_DIRECTORY + path.sep) ||
      !fs.existsSync(filePath)
    ) {
      return sendError(res, 404, "Audit log export file not found.");
    }
    return res.download(filePath, `audit-logs.${exportRecord.format}`);
  } catch (_error) {
    return sendError(res, 500, "Server error downloading audit log export.");
  }
};
