import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import AuditLog from "../models/auditLogModel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AUDIT_EXPORT_DIRECTORY = path.join(__dirname, "..", "uploads", "audit-log-exports");

const columns = [
  { header: "Timestamp", key: "timestamp", width: 25 },
  { header: "Actor Name", key: "actorName", width: 28 },
  { header: "Actor Email", key: "actorEmail", width: 32 },
  { header: "Action", key: "action", width: 28 },
  { header: "Entity", key: "entity", width: 24 },
  { header: "Entity ID", key: "entityId", width: 28 },
  { header: "Details", key: "details", width: 60 },
];

export const buildAuditLogFilter = ({ organizationId, action, startDate, endDate }) => {
  const filter = { organization: organizationId };
  if (action) filter.action = String(action);
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }
  return filter;
};

export const toExportRow = (log) => ({
  timestamp: log.createdAt ? new Date(log.createdAt).toISOString() : "",
  actorName: log.actor?.name || "",
  actorEmail: log.actor?.email || "",
  action: log.action || "",
  entity: log.entity || "",
  entityId: log.entityId?.toString() || "",
  details: log.details ? JSON.stringify(log.details) : "",
});

const csvValue = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const csvLine = (row) => columns.map(({ key }) => csvValue(row[key])).join(",") + "\n";
const csvHeader = () => columns.map(({ header }) => csvValue(header)).join(",") + "\n";

const getCursor = (filter) =>
  AuditLog.find(filter)
    .populate("actor", "name email")
    .sort({ createdAt: -1 })
    .lean()
    .cursor();

const writeWithBackpressure = async (stream, value) => {
  if (!stream.write(value)) {
    await new Promise((resolve, reject) => {
      stream.once("drain", resolve);
      stream.once("error", reject);
    });
  }
};

export const streamCsvExport = async (res, filter) => {
  await writeWithBackpressure(res, csvHeader());
  for await (const log of getCursor(filter)) {
    await writeWithBackpressure(res, csvLine(toExportRow(log)));
  }
  res.end();
};

export const streamXlsxExport = async (res, filter) => {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
  const worksheet = workbook.addWorksheet("Audit Logs");
  worksheet.columns = columns;
  worksheet.getRow(1).font = { bold: true };
  for await (const log of getCursor(filter)) worksheet.addRow(toExportRow(log)).commit();
  worksheet.commit();
  await workbook.commit();
};

export const createAuditLogExportFile = async ({ exportId, format, filter }) => {
  await fs.promises.mkdir(AUDIT_EXPORT_DIRECTORY, { recursive: true });
  const fileName = `audit-logs-${exportId}.${format}`;
  const filePath = path.join(AUDIT_EXPORT_DIRECTORY, fileName);

  if (format === "csv") {
    const output = fs.createWriteStream(filePath);
    await writeWithBackpressure(output, csvHeader());
    for await (const log of getCursor(filter)) {
      await writeWithBackpressure(output, csvLine(toExportRow(log)));
    }
    await new Promise((resolve, reject) => output.end(resolve).on("error", reject));
  } else {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: filePath });
    const worksheet = workbook.addWorksheet("Audit Logs");
    worksheet.columns = columns;
    worksheet.getRow(1).font = { bold: true };
    for await (const log of getCursor(filter)) worksheet.addRow(toExportRow(log)).commit();
    worksheet.commit();
    await workbook.commit();
  }

  return { fileName, filePath };
};
