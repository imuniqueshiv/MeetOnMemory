import mongoose from "mongoose";

/**
 * policyComplianceSchema — a single decision↔policy relationship record.
 *
 * One row per (decision, policy) pair that surfaced as a similarity match.
 * `classification` is the LLM's read of the relationship; `status` is the
 * separate human-review workflow state (only meaningful once a row is
 * surfaced as a flag — see policyComplianceService's flag semantics).
 */
const policyComplianceSchema = new mongoose.Schema(
  {
    decisionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Decision",
      required: true,
    },
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Policy",
      required: true,
    },
    sourceMeetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true, // compliance matching is org-scoped only; see service guard
    },

    // Snapshot of the policy version this classification was made against.
    // Lets us detect staleness when previousVersions grows (superseded policy).
    policyVersion: { type: String, required: true },

    similarityScore: { type: Number, required: true },

    // Note: "unclassified" means the LLM call itself failed (network error,
    // missing key, timeout) — distinct from "unrelated", which means the
    // LLM successfully evaluated the pair and found no real connection.
    // Keeping these separate stops transient API failures from being
    // silently indistinguishable from genuine negatives.
    classification: {
      type: String,
      enum: [
        "aligned",
        "references",
        "potential_conflict",
        "unrelated",
        "unclassified",
      ],
      required: true,
    },
    reasoning: { type: String, default: "" },

    // Human review workflow — only acted on by the UI for potential_conflict rows.
    status: {
      type: String,
      enum: ["unresolved", "acknowledged", "dismissed"],
      default: "unresolved",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },

    // Set/bumped whenever the matched policy version changes and this row
    // is re-evaluated against the current text (acceptance criterion:
    // "Superseded policy versions trigger re-evaluation").
    lastEvaluatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// A decision is only ever linked to a given policy once — re-evaluation
// updates the existing row rather than creating duplicates.
policyComplianceSchema.index({ decisionId: 1, policyId: 1 }, { unique: true });
policyComplianceSchema.index({ organization: 1, status: 1, classification: 1 });
policyComplianceSchema.index({ policyId: 1 });

const PolicyCompliance =
  mongoose.models.PolicyCompliance ||
  mongoose.model("PolicyCompliance", policyComplianceSchema);

export default PolicyCompliance;
