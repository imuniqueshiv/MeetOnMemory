import Decision from "../../models/decisionModel.js";
import ActionItem from "../../models/actionItemModel.js";

export const MODEL_REGISTRY = {
  decision: {
    Model: Decision,
    label: "Decision",
    // Fields (beyond text/aliases/relatesTo/history, which are handled
    // generically) that can disagree between duplicates and need a
    // resolution rule.
    conflictFields: ["owner", "status"],
  },
  actionItem: {
    Model: ActionItem,
    label: "ActionItem",
    conflictFields: ["owner", "status", "dueDate"],
  },
};

export function assertSupportedModel(modelType) {
  if (!MODEL_REGISTRY[modelType]) {
    throw new Error(
      `Unsupported memory type "${modelType}". Expected one of: ${Object.keys(
        MODEL_REGISTRY,
      ).join(", ")}`,
    );
  }
  return MODEL_REGISTRY[modelType];
}
