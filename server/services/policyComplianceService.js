// ==============================================
// 📘 policyComplianceService.js
// Cross-references meeting decisions against organizational policies.
//
// Pipeline:
//   1. Policies are embedded (summary + key_changes) and upserted into a
//      dedicated Pinecone namespace ("policies"), kept separate from the
//      "meetings" vectors already indexed by embeddingUtils.js.
//   2. When a meeting's decisions are extracted, each decision is embedded
//      and matched against that namespace (subject-matter overlap).
//   3. High-similarity matches get a narrow, separate LLM classification
//      pass (aligned / references / potential_conflict / unrelated), with
//      an "unclassified" state reserved for when the LLM call itself fails
//      (kept distinct from a genuine "unrelated" result).
//
// This module never blocks meeting summarization: callers (meetingController)
// wrap invocations in try/catch and treat failures here as non-fatal.
// ==============================================

import axios from "axios";
import dotenv from "dotenv";
import Policy from "../models/policyModel.js";
import PolicyCompliance from "../models/policyComplianceModel.js";
import { embedText, initVectorStore } from "../utils/embeddingUtils.js";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Namespace policy vectors separately from meeting vectors so semantic
// search over meetings never picks up policy text and vice versa.
const POLICY_NAMESPACE = "policies";

// Similarity floor for "this decision plausibly touches this policy" —
// deliberately looser than a conflict signal. The LLM pass afterwards is
// what decides whether it's actually aligned/references/conflicting.
const MATCH_SIMILARITY_THRESHOLD = 0.55;

// Cap how many candidate policies get sent to the (costlier) LLM pass per decision.
const MAX_MATCHES_PER_DECISION = 5;

// ─────────────────────────────────────────────────────────────
// Helper — strip markdown code fences Gemini sometimes adds
// (mirrors policyController.js's extractJson so behavior is consistent)
// ─────────────────────────────────────────────────────────────
const extractJson = (raw) => {
  if (!raw) return "{}";
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
};

/**
 * Parses and validates the raw LLM response into a safe, conservative
 * classification result. Pure function — no I/O — so it's unit-testable
 * without a live Gemini call.
 */
export function parseClassification(rawText) {
  const ALLOWED = ["aligned", "references", "potential_conflict", "unrelated"];

  try {
    const cleaned = extractJson(rawText);
    const parsed = JSON.parse(cleaned);

    const classification = ALLOWED.includes(parsed.classification)
      ? parsed.classification
      : "unrelated";

    const reasoning =
      typeof parsed.reasoning === "string" && parsed.reasoning.trim()
        ? parsed.reasoning.trim().slice(0, 1000)
        : "";

    return { classification, reasoning };
  } catch {
    // Fail conservative: an unparsable response never becomes a conflict flag.
    return {
      classification: "unrelated",
      reasoning: "Classification response could not be parsed.",
    };
  }
}

/**
 * Builds the narrow classification prompt. Kept separate from the network
 * call so prompt content can be reviewed/tested without hitting Gemini.
 */
export function buildClassificationPrompt(decisionText, policy) {
  const keyChanges = Array.isArray(policy.key_changes)
    ? policy.key_changes.join("; ")
    : "";

  return `
You are a conservative compliance analyst. Compare the MEETING DECISION below against
the POLICY EXCERPT and classify their relationship.

Classification rules (be conservative — false "potential_conflict" flags erode trust):
- "potential_conflict": the decision appears to contradict or violate a specific
  requirement in the policy. Only use this if genuinely confident.
- "references": the decision explicitly mentions or acts under this policy without
  conflicting with it.
- "aligned": the decision touches the same subject matter and is consistent with the policy.
- "unrelated": default to this unless there is clear, specific subject-matter overlap.

MEETING DECISION:
${decisionText}

POLICY: ${policy.name} (version ${policy.version})
POLICY SUMMARY:
${policy.summary?.slice(0, 3000) || ""}
KEY CHANGES:
${keyChanges.slice(0, 1000)}

Return ONLY valid JSON, no commentary, no markdown fences:
{
  "classification": "aligned" | "references" | "potential_conflict" | "unrelated",
  "reasoning": "one or two sentence justification"
}
`;
}

/**
 * Single attempt at the Gemini call. Throws on any failure — retry/fallback
 * handling lives in the caller so this stays a plain, testable unit.
 */
async function callGeminiClassifier(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    { contents: [{ parts: [{ text: prompt }] }] },
    { timeout: 20000 },
  );

  return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
}

/**
 * Narrow, isolated Gemini call for a single decision/policy pair.
 * Deliberately separate from the general meeting-summarization LLM pass
 * (per the issue's technical considerations) so a failure here is contained.
 *
 * Retries once on transient failure (network blip, rate limit). If both
 * attempts fail, the result is "unclassified" — NOT "unrelated". Those two
 * must stay distinguishable: "unrelated" means the LLM looked at the pair
 * and found no connection; "unclassified" means we never got an answer.
 * Collapsing them would hide real API outages inside what looks like a
 * clean negative result, and "unclassified" rows are excluded from the
 * default flags dashboard (?classification=potential_conflict) so they
 * don't show up as false conflicts either — they need a separate retry
 * pass, not a review action.
 */
async function classifyRelationship(decisionText, policy) {
  const prompt = buildClassificationPrompt(decisionText, policy);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const rawText = await callGeminiClassifier(prompt);
      return parseClassification(rawText);
    } catch (error) {
      console.error(
        `❌ Policy compliance classification failed (attempt ${attempt}/2):`,
        error.message,
      );
      if (attempt === 2) {
        return {
          classification: "unclassified",
          reasoning:
            "Classification unavailable after retry (LLM call failed).",
        };
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Policy embedding pipeline
// ─────────────────────────────────────────────────────────────

/**
 * Embeds a policy's summary + key_changes and upserts it into the
 * dedicated Pinecone policy namespace. Call after create/update.
 * Non-fatal on failure — logs and returns without throwing, so it never
 * blocks the policy upload/analyze response.
 */
export async function indexPolicy(policy) {
  try {
    if (!policy?.organization) {
      console.warn(
        `⚠️ Skipping policy index for "${policy?.name}" — no organization on record.`,
      );
      return;
    }

    const combinedText = `${policy.name}\n${policy.summary || ""}\n${(policy.key_changes || []).join(". ")}`;
    if (!combinedText.trim()) return;

    const embedding = await embedText(combinedText);
    if (!embedding.length) return;

    const index = await initVectorStore();
    await index.namespace(POLICY_NAMESPACE).upsert([
      {
        id: policy._id.toString(),
        values: embedding,
        metadata: {
          type: "policy",
          policyId: policy._id.toString(),
          organization: policy.organization.toString(),
          name: policy.name,
          version: policy.version,
        },
      },
    ]);

    console.log(
      `✅ Indexed policy in Pinecone: ${policy.name} (v${policy.version})`,
    );
  } catch (error) {
    console.error("❌ Failed to index policy:", error.message);
  }
}

/**
 * Removes a policy's vector from the index. Call on policy delete.
 */
export async function removePolicyFromIndex(policyId) {
  try {
    const index = await initVectorStore();
    await index.namespace(POLICY_NAMESPACE).deleteOne(policyId.toString());
  } catch (error) {
    console.error("❌ Failed to remove policy from index:", error.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Decision → policy matching + classification
// ─────────────────────────────────────────────────────────────

/**
 * Queries the policy namespace for candidate matches, scoped strictly to
 * the decision's organization (multi-tenant correctness — never cross-
 * reference one organization's meeting against another's policies).
 */
async function findCandidatePolicies(decisionEmbedding, organizationId) {
  if (!organizationId) return [];

  const index = await initVectorStore();
  const results = await index.namespace(POLICY_NAMESPACE).query({
    vector: decisionEmbedding,
    topK: MAX_MATCHES_PER_DECISION,
    includeMetadata: true,
    filter: { organization: { $eq: organizationId.toString() } },
  });

  return (results.matches || [])
    .filter((m) => (m.score ?? 0) >= MATCH_SIMILARITY_THRESHOLD)
    .map((m) => ({
      policyId: m.metadata?.policyId || m.id,
      similarityScore: m.score,
    }));
}

/**
 * Processes one decision↔policy candidate: fetch the policy, classify the
 * relationship, and upsert the compliance record. Isolated into its own
 * function (rather than inline in a loop) so candidates can run in
 * parallel via Promise.allSettled — each is an independent Gemini call and
 * there's no reason to serialize them.
 */
async function evaluateCandidate(candidate, decision, meeting, organizationId) {
  const policy = await Policy.findById(candidate.policyId);
  if (
    !policy ||
    policy.organization?.toString() !== organizationId.toString()
  ) {
    return null; // stale vector or cross-org leak guard
  }

  const [{ classification, reasoning }, existing] = await Promise.all([
    classifyRelationship(decision.text, policy),
    PolicyCompliance.findOne({
      decisionId: decision._id,
      policyId: policy._id,
    }),
  ]);

  // Reopen the review workflow only when the classification actually
  // changed (e.g. aligned -> potential_conflict on re-run/re-evaluation).
  // A re-confirmed classification leaves an existing acknowledge/dismiss
  // untouched; a newly-detected conflict must not stay silently resolved.
  const classificationChanged =
    !existing || existing.classification !== classification;

  const update = {
    decisionId: decision._id,
    policyId: policy._id,
    sourceMeetingId: meeting._id,
    organization: organizationId,
    policyVersion: policy.version,
    similarityScore: candidate.similarityScore,
    classification,
    reasoning,
    lastEvaluatedAt: new Date(),
  };

  if (classificationChanged) {
    update.status = "unresolved";
    update.reviewedBy = null;
    update.reviewedAt = null;
  }

  return PolicyCompliance.findOneAndUpdate(
    { decisionId: decision._id, policyId: policy._id },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

/**
 * Main entry point: given a single freshly-created/updated Decision doc,
 * find subject-matter-overlapping policies and classify each relationship.
 * Called from the meeting knowledge-graph hook — one call per decision.
 */
export async function checkDecisionAgainstPolicies(decision, meeting) {
  try {
    const organizationId = meeting.organization;
    if (!organizationId) {
      // No organization — no policies to cross-reference against.
      return [];
    }

    const embedding = decision.embedding?.length
      ? decision.embedding
      : await embedText(decision.text);

    const candidates = await findCandidatePolicies(embedding, organizationId);
    if (!candidates.length) return [];

    // Run candidate evaluations (each up to one Gemini call + a retry) in
    // parallel rather than serially — this is the dominant cost when a
    // decision matches several policies, and each candidate is independent.
    // allSettled so one candidate's failure doesn't discard the others.
    const settled = await Promise.allSettled(
      candidates.map((candidate) =>
        evaluateCandidate(candidate, decision, meeting, organizationId),
      ),
    );

    return settled
      .filter((result) => result.status === "fulfilled" && result.value)
      .map((result) => result.value);
  } catch (error) {
    console.error(
      "❌ Policy compliance check failed for decision:",
      error.message,
    );
    return [];
  }
}

/**
 * Runs checkDecisionAgainstPolicies for every decision produced by a
 * meeting's structuredMoM. Called from meetingController right after
 * processStructuredMoM() so it shares the same non-fatal try/catch wrapper.
 * Decisions are independent of one another, so they run in parallel too —
 * a meeting with several decisions no longer pays for their Gemini calls
 * serially on the request path.
 */
export async function checkMeetingDecisionsAgainstPolicies(meeting, decisions) {
  if (!decisions?.length) return [];

  const settled = await Promise.allSettled(
    decisions.map((decision) =>
      checkDecisionAgainstPolicies(decision, meeting),
    ),
  );

  return settled
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);
}

/**
 * Re-evaluates every existing compliance record pointing at this policy
 * against its current (post-supersede) summary/key_changes/version.
 * Acceptance criterion: superseded policies must not leave decisions
 * silently pointing at stale policy text.
 */
export async function reevaluatePolicyDecisions(policy) {
  try {
    const records = await PolicyCompliance.find({ policyId: policy._id });
    if (!records.length) return [];

    const Decision = (await import("../models/decisionModel.js")).default;

    const settled = await Promise.allSettled(
      records.map(async (record) => {
        const decision = await Decision.findById(record.decisionId);
        if (!decision) return null;

        const { classification, reasoning } = await classifyRelationship(
          decision.text,
          policy,
        );

        record.policyVersion = policy.version;
        record.classification = classification;
        record.reasoning = reasoning;
        record.lastEvaluatedAt = new Date();
        // A version change is a material update — put it back in front of a
        // reviewer rather than leaving a stale acknowledge/dismiss in place,
        // regardless of whether the reclassification happens to match the
        // old one (the policy text itself changed, so the prior review no
        // longer speaks to what's actually in effect now).
        record.status = "unresolved";
        record.reviewedBy = null;
        record.reviewedAt = null;
        await record.save();
        return record;
      }),
    );

    return settled
      .filter((result) => result.status === "fulfilled" && result.value)
      .map((result) => result.value);
  } catch (error) {
    console.error("❌ Failed to re-evaluate policy decisions:", error.message);
    return [];
  }
}
