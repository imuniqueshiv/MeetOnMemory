import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    entity: {
      type: String,
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual aliases for issue #496 requirements
auditLogSchema.virtual("organizationId").get(function () {
  return this.organization;
});

auditLogSchema.virtual("actorId").get(function () {
  return this.actor;
});

auditLogSchema.virtual("targetType").get(function () {
  return this.entity;
});

auditLogSchema.virtual("targetId").get(function () {
  return this.entityId;
});

auditLogSchema.virtual("metadata").get(function () {
  return this.details;
});

// Create compound index for sorting by date within an org
auditLogSchema.index({ organization: 1, createdAt: -1 });

export default mongoose.models.AuditLog ||
  mongoose.model("AuditLog", auditLogSchema);
