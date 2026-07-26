import mongoose from "mongoose";

const auditLogExportSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    format: { type: String, enum: ["csv", "xlsx"], required: true },
    filters: {
      action: String,
      startDate: Date,
      endDate: Date,
    },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
    },
    fileName: String,
    error: String,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

auditLogExportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("AuditLogExport", auditLogExportSchema);
