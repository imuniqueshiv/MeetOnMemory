// Integration coverage for the parts of the policy compliance pipeline that
// need real infrastructure: the local embedding model, a live Pinecone
// index, and MongoDB. These are skipped by default (no network/DB access in
// most CI runs of this suite) and only execute when RUN_POLICY_COMPLIANCE_IT=1
// is set alongside a working .env (MONGODB_URI, PINECONE_API_KEY, INDEX_NAME).
//
// Run locally with:
//   RUN_POLICY_COMPLIANCE_IT=1 npm test
//
// The pure-logic tests in policyComplianceService.test.js run unconditionally
// and don't need this setup.

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const RUN_IT = process.env.RUN_POLICY_COMPLIANCE_IT === "1";
const describeOrSkip = RUN_IT ? describe : describe.skip;

describeOrSkip("policy compliance — integration", () => {
  let embedText,
    indexPolicy,
    removePolicyFromIndex,
    checkDecisionAgainstPolicies;
  let Policy, Decision, PolicyCompliance;

  beforeAll(async () => {
    ({ embedText } = await import("../utils/embeddingUtils.js"));
    ({ indexPolicy, removePolicyFromIndex, checkDecisionAgainstPolicies } =
      await import("../services/policyComplianceService.js"));
    Policy = (await import("../models/policyModel.js")).default;
    Decision = (await import("../models/decisionModel.js")).default;
    PolicyCompliance = (await import("../models/policyComplianceModel.js"))
      .default;

    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/test",
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  test("embedding pipeline produces a consistent-length vector", async () => {
    const a = await embedText(
      "Expense reimbursements require pre-approval above $500.",
    );
    const b = await embedText(
      "A completely unrelated sentence about lunch catering.",
    );
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBe(b.length);
  });

  test("similarity matching only surfaces same-organization policies", async () => {
    const orgA = new mongoose.Types.ObjectId();
    const orgB = new mongoose.Types.ObjectId();

    const policyA = await Policy.create({
      name: "IT-A Expense Policy",
      version: "1.0",
      fileUrl: "test://irrelevant",
      summary:
        "All reimbursements above $500 require written pre-approval from a department head.",
      key_changes: [],
      organization: orgA,
    });

    const policyB = await Policy.create({
      name: "IT-B Expense Policy",
      version: "1.0",
      fileUrl: "test://irrelevant",
      summary:
        "All reimbursements above $500 require written pre-approval from a department head.",
      key_changes: [],
      organization: orgB,
    });

    await indexPolicy(policyA);
    await indexPolicy(policyB);

    const decision = await Decision.create({
      text: "Approved a $1200 purchase without pre-approval.",
      sourceMeetingId: new mongoose.Types.ObjectId(),
      organization: orgA,
      embedding: await embedText(
        "Approved a $1200 purchase without pre-approval.",
      ),
    });

    const meeting = { _id: decision.sourceMeetingId, organization: orgA };

    const flags = await checkDecisionAgainstPolicies(decision, meeting);

    // Every flag produced must point at a policy in orgA — never orgB,
    // even though policyB has near-identical text and would otherwise match.
    for (const flag of flags) {
      expect(flag.organization.toString()).toBe(orgA.toString());
      expect(flag.policyId.toString()).not.toBe(policyB._id.toString());
    }

    await PolicyCompliance.deleteMany({ decisionId: decision._id });
    await Decision.deleteOne({ _id: decision._id });
    await removePolicyFromIndex(policyA._id);
    await removePolicyFromIndex(policyB._id);
    await Policy.deleteMany({ _id: { $in: [policyA._id, policyB._id] } });
  });
});
