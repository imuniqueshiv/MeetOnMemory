import mongoose from "mongoose";
import PolicyCompliance from "../models/policyComplianceModel.js";
import Decision from "../models/decisionModel.js";
import Policy from "../models/policyModel.js";
import { sendSuccess, sendError } from "../utils/responseHandler.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ─────────────────────────────────────────────────────────────
// GET /api/policy-compliance/decisions/:decisionId
// Returns any linked policies and their relationship classification.
// ─────────────────────────────────────────────────────────────
export const getDecisionCompliance = async (req, res) => {
  try {
    const { decisionId } = req.params;
    const organization = req.user.organization;

    if (!isValidId(decisionId)) {
      return sendError(res, 400, "Invalid decision id");
    }

    // Verify the decision belongs to the caller's organization before
    // returning anything — never leak cross-organization data.
    const decision =
      await Decision.findById(decisionId).select("organization text createdAt");

    if (
      !decision ||
      !organization ||
      decision.organization?.toString() !== organization.toString()
    ) {
      return sendError(res, 404, "Decision not found");
    }

    const effectivePolicies = await Policy.find({
      organization,
      createdAt: { $lte: decision.createdAt },
    }).select("_id");

    const records = await PolicyCompliance.find({
      decisionId,
      organization,
      policyId: { $in: effectivePolicies.map((policy) => policy._id) },
    })
      .populate("policyId", "name version summary")
      .sort({ similarityScore: -1 });

    return sendSuccess(res, {
      decision: { id: decision._id, text: decision.text },
      compliance: records,
    });
  } catch (error) {
    console.error("getDecisionCompliance error:", error);
    return sendError(res, 500, "Failed to fetch decision compliance data");
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/policy-compliance/policies/:policyId/related-decisions
// Reverse lookup: every decision across all meetings that touched this policy.
// ─────────────────────────────────────────────────────────────
export const getPolicyRelatedDecisions = async (req, res) => {
  try {
    const { policyId } = req.params;
    const organization = req.user.organization;

    if (!isValidId(policyId)) {
      return sendError(res, 400, "Invalid policy id");
    }

    const policy = await Policy.findById(policyId).select(
      "organization name version",
    );

    if (
      !policy ||
      !organization ||
      policy.organization?.toString() !== organization.toString()
    ) {
      return sendError(res, 404, "Policy not found");
    }

    const records = await PolicyCompliance.find({
      policyId,
      organization,
    })
      .populate("decisionId", "text status")
      .populate("sourceMeetingId", "title date")
      .sort({ createdAt: -1 });

    return sendSuccess(res, {
      policy: { id: policy._id, name: policy.name, version: policy.version },
      relatedDecisions: records,
    });
  } catch (error) {
    console.error("getPolicyRelatedDecisions error:", error);
    return sendError(res, 500, "Failed to fetch related decisions");
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/policy-compliance/flags?status=unresolved&classification=potential_conflict
// Dashboard of unresolved (or filtered) flags for the caller's organization.
// Note: the organization scope always comes from the authenticated user,
// never from a client-supplied query param — that would be a multi-tenant
// data leak vector.
// ─────────────────────────────────────────────────────────────

// Whitelists below are the only values ever assigned into a Mongo filter
// object built from req.query. Express's query parser turns bracket
// notation (e.g. ?classification[$ne]=null) into nested objects, so any
// unvalidated req.query value used directly as a filter is a NoSQL
// injection vector — every user-supplied filter value must be checked
// against one of these lists (or validated as an ObjectId) before use.
const ALLOWED_STATUSES = ["unresolved", "acknowledged", "dismissed", "all"];
const ALLOWED_CLASSIFICATIONS = [
  "aligned",
  "references",
  "potential_conflict",
  "unrelated",
  "unclassified",
  "all",
];

export const getComplianceFlags = async (req, res) => {
  try {
    const organization = req.user.organization;
    if (!organization) {
      return sendError(res, 403, "Forbidden: Organization membership required");
    }

    const { status = "unresolved", classification = "potential_conflict" } =
      req.query;

    if (typeof status !== "string" || !ALLOWED_STATUSES.includes(status)) {
      return sendError(res, 400, "Invalid status");
    }
    if (
      typeof classification !== "string" ||
      !ALLOWED_CLASSIFICATIONS.includes(classification)
    ) {
      return sendError(res, 400, "Invalid classification");
    }

    const query = { organization };
    if (status !== "all") query.status = status;
    if (classification !== "all") query.classification = classification;

    const flags = await PolicyCompliance.find(query)
      .populate("decisionId", "text")
      .populate("policyId", "name version")
      .populate("sourceMeetingId", "title date")
      .sort({ createdAt: -1 });

    return sendSuccess(res, { flags });
  } catch (error) {
    console.error("getComplianceFlags error:", error);
    return sendError(res, 500, "Failed to fetch compliance flags");
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/policy-compliance/flags/:id
// Acknowledge or dismiss a flag. Detection/flagging only — this never
// blocks or auto-rejects the underlying meeting decision.
// ─────────────────────────────────────────────────────────────
export const updateFlagStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const organization = req.user.organization;

    if (!isValidId(id)) {
      return sendError(res, 400, "Invalid flag id");
    }

    const allowedStatuses = ALLOWED_STATUSES.filter((s) => s !== "all");
    if (typeof status !== "string" || !allowedStatuses.includes(status)) {
      return sendError(res, 400, "Invalid status");
    }

    const flag = await PolicyCompliance.findOne({ _id: id, organization });
    if (!flag) {
      return sendError(res, 404, "Flag not found");
    }

    flag.status = status;
    flag.reviewedBy = status === "unresolved" ? null : req.user._id;
    flag.reviewedAt = status === "unresolved" ? null : new Date();
    await flag.save();

    return sendSuccess(res, { flag });
  } catch (error) {
    console.error("updateFlagStatus error:", error);
    return sendError(res, 500, "Failed to update flag status");
  }
};
