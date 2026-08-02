import { z } from "zod";
import AutomationRule from "../models/automationRuleModel.js";
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} from "../utils/errors.js";
import { sendSuccess } from "../utils/responseHandler.js";

// Validation schemas
const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  trigger: z.object({
    event: z.enum([
      "meeting.created",
      "mom.generated",
      "actionItem.completed",
      "export.ready",
    ]),
    filters: z.record(z.any()).optional(),
  }),
  actions: z
    .array(
      z.object({
        type: z.enum(["email", "slack", "webhook", "tag"]),
        config: z.record(z.any()).optional(),
      }),
    )
    .min(1),
  enabled: z.boolean().optional(),
});

const updateRuleSchema = createRuleSchema.partial();

const getOrgId = (req) => {
  const orgId = req.user?.organization;
  if (!orgId)
    throw new UnauthorizedError("User is not associated with an organization");
  return orgId;
};

// CRUD Operations

export const createRule = async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
    const userId = req.user?.id || req.user?._id;

    const validated = createRuleSchema.parse(req.body);

    const rule = new AutomationRule({
      ...validated,
      organization: orgId,
      createdBy: userId,
    });

    await rule.save();

    return sendSuccess(
      res,
      { rule },
      "Automation rule created successfully.",
      201,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(
        new ValidationError(
          "Invalid rule configuration: " +
            error.errors.map((e) => e.message).join(", "),
        ),
      );
    } else {
      next(error);
    }
  }
};

export const getRules = async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
    const rules = await AutomationRule.find({ organization: orgId }).sort({
      createdAt: -1,
    });
    return sendSuccess(res, { rules }, "Automation rules retrieved.");
  } catch (error) {
    next(error);
  }
};

export const getRuleById = async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
    const rule = await AutomationRule.findOne({
      _id: req.params.id,
      organization: orgId,
    });
    if (!rule) throw new NotFoundError("Automation rule not found");

    return sendSuccess(res, { rule }, "Automation rule retrieved.");
  } catch (error) {
    next(error);
  }
};

export const updateRule = async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
    const validated = updateRuleSchema.parse(req.body);

    const rule = await AutomationRule.findOneAndUpdate(
      { _id: req.params.id, organization: orgId },
      { $set: validated },
      { new: true, runValidators: true },
    );

    if (!rule) throw new NotFoundError("Automation rule not found");

    return sendSuccess(res, { rule }, "Automation rule updated.");
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(
        new ValidationError(
          "Invalid rule configuration: " +
            error.errors.map((e) => e.message).join(", "),
        ),
      );
    } else {
      next(error);
    }
  }
};

export const toggleRuleStatus = async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      throw new ValidationError("Enabled status must be a boolean");
    }

    const rule = await AutomationRule.findOneAndUpdate(
      { _id: req.params.id, organization: orgId },
      { $set: { enabled } },
      { new: true },
    );

    if (!rule) throw new NotFoundError("Automation rule not found");

    return sendSuccess(
      res,
      { rule },
      `Automation rule ${enabled ? "enabled" : "disabled"}.`,
    );
  } catch (error) {
    next(error);
  }
};

export const deleteRule = async (req, res, next) => {
  try {
    const orgId = getOrgId(req);
    const rule = await AutomationRule.findOneAndDelete({
      _id: req.params.id,
      organization: orgId,
    });

    if (!rule) throw new NotFoundError("Automation rule not found");

    return sendSuccess(res, null, "Automation rule deleted.");
  } catch (error) {
    next(error);
  }
};
