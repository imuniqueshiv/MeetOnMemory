import mongoose from "mongoose";

const automationRuleSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    trigger: {
      event: {
        type: String,
        required: true,
        enum: [
          "meeting.created",
          "mom.generated",
          "actionItem.completed",
          "export.ready",
        ],
      },
      filters: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    actions: [
      {
        type: {
          type: String,
          required: true,
          enum: ["email", "slack", "webhook", "tag"],
        },
        config: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    ],
    executionCount: {
      type: Number,
      default: 0,
    },
    lastExecutedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

automationRuleSchema.index({ organization: 1, enabled: 1 });
automationRuleSchema.index({ "trigger.event": 1 });

const AutomationRule = mongoose.model("AutomationRule", automationRuleSchema);

export default AutomationRule;
