import AuditLogExport from "../models/auditLogExportModel.js";
import { buildAuditLogFilter, createAuditLogExportFile } from "../services/auditLogExportService.js";

export default async function auditLogExportJob(job) {
  const exportRecord = await AuditLogExport.findById(job.data.exportId);
  if (!exportRecord) return;

  await exportRecord.updateOne({ status: "processing", error: undefined });
  try {
    const filter = buildAuditLogFilter({
      organizationId: exportRecord.organization,
      ...exportRecord.filters,
    });
    const { fileName } = await createAuditLogExportFile({
      exportId: exportRecord._id,
      format: exportRecord.format,
      filter,
    });
    await exportRecord.updateOne({ status: "completed", fileName });
  } catch (error) {
    await exportRecord.updateOne({ status: "failed", error: error.message });
    throw error;
  }
}
