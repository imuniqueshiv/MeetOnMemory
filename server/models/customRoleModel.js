import mongoose from "mongoose";

const CustomRoleSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: Number,
      default: 10,
    },
    permissions: {
      meetings: {
        view: { type: Boolean, default: true },
        create: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
      },
      transcripts: {
        view: { type: Boolean, default: true },
        edit: { type: Boolean, default: false },
        export: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
      },
      knowledge: {
        view: { type: Boolean, default: true },
        create: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
      },
      policies: {
        view: { type: Boolean, default: false },
        manage: { type: Boolean, default: false },
      },
      members: {
        view: { type: Boolean, default: true },
        invite: { type: Boolean, default: false },
        manageRoles: { type: Boolean, default: false },
      },
    },
  },
  {
    timestamps: true,
  },
);

CustomRoleSchema.index({ organizationId: 1, name: 1 }, { unique: true });

const CustomRole = mongoose.model("CustomRole", CustomRoleSchema);

export default CustomRole;
