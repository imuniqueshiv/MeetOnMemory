import mongoose from "mongoose";

const actionItemChangeLogSchema = new mongoose.Schema(
  {
    actionItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ActionItem",
      required: true,
      index: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changeType: {
      type: String,
      required: true,
      enum: [
        "status",
        "assignee",
        "dueDate",
        "priority",
        "title",
        "text",
        "description",
      ],
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

actionItemChangeLogSchema.index({ actionItemId: 1, createdAt: -1 });
actionItemChangeLogSchema.index({ changedBy: 1, createdAt: -1 });

const ActionItemChangeLog =
  mongoose.models.ActionItemChangeLog ||
  mongoose.model("ActionItemChangeLog", actionItemChangeLogSchema);

export default ActionItemChangeLog;
