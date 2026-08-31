import MeetingBudget from "../models/meetingBudgetModel.js";
import { computeBudgetSummary } from "../utils/budgetSummary.js";

const resolveOrgId = (req) =>
  req.body?.organizationId ||
  req.query?.organizationId ||
  req.user?.organization?._id ||
  req.user?.organization ||
  req.user?.organizationId;

/**
 * Create a meeting budget scoped to the caller's organization.
 * @route POST /api/meeting-budgets
 */
export const createBudget = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res
        .status(403)
        .json({ success: false, message: "Organization required" });
    }

    const { name, totalBudget, currency, periodStart, periodEnd, expenses } =
      req.body || {};

    const budget = await MeetingBudget.create({
      organization: orgId,
      name,
      totalBudget,
      currency,
      periodStart,
      periodEnd,
      expenses: Array.isArray(expenses) ? expenses : [],
      createdBy: req.user?._id || req.user?.id,
    });

    return res.status(201).json({ success: true, data: budget });
  } catch (error) {
    console.error("Error creating meeting budget:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * List meeting budgets for the caller's organization.
 * @route GET /api/meeting-budgets
 */
export const listBudgets = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res
        .status(403)
        .json({ success: false, message: "Organization required" });
    }

    const budgets = await MeetingBudget.find({ organization: orgId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: budgets });
  } catch (error) {
    console.error("Error listing meeting budgets:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Get the computed utilization/burn-rate summary for one budget.
 * @route GET /api/meeting-budgets/:id/summary
 */
export const getBudgetSummary = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      return res
        .status(403)
        .json({ success: false, message: "Organization required" });
    }

    const budget = await MeetingBudget.findOne({
      _id: req.params.id,
      organization: orgId,
    }).lean();

    if (!budget) {
      return res
        .status(404)
        .json({ success: false, message: "Budget not found" });
    }

    const summary = computeBudgetSummary(budget, budget.expenses);
    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error("Error computing budget summary:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
