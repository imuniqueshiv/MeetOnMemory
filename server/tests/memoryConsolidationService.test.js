import mongoose from "mongoose";
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import {
  areMemoriesSimilar,
  buildDuplicateClusters,
  selectCanonical,
  mergeCluster,
  consolidateMemories,
} from "../services/memoryConsolidationService.js";

const organizationId = new mongoose.Types.ObjectId();
const meetingA = new mongoose.Types.ObjectId();
const meetingB = new mongoose.Types.ObjectId();
const meetingC = new mongoose.Types.ObjectId();

beforeAll(async () => {
  await mongoose.connect(
    `${process.env.TEST_MONGODB_URI}/memory_consolidation`,
  );
});

function makeEmbedding(seed) {
  // Deterministic pseudo-embedding: near-identical vectors for the same
  // seed, distinct vectors for different seeds.
  return Array.from({ length: 8 }, (_, i) => Math.sin(seed * (i + 1)));
}

describe("areMemoriesSimilar", () => {
  test("flags paraphrased text as duplicates via text similarity", () => {
    const a = { text: "I live in Delhi", embedding: [] };
    const b = { text: "My home city is Delhi", embedding: [] };
    const result = areMemoriesSimilar(a, b, { textThreshold: 0.3 });
    expect(result.isDuplicate).toBe(true);
  });

  test("does not flag unrelated memories as duplicates", () => {
    const a = { text: "I live in Delhi", embedding: [] };
    const b = { text: "The Q3 budget was approved", embedding: [] };
    const result = areMemoriesSimilar(a, b);
    expect(result.isDuplicate).toBe(false);
  });

  test("uses embeddings when available", () => {
    const a = { text: "alpha", embedding: makeEmbedding(1) };
    const b = { text: "beta", embedding: makeEmbedding(1) };
    const result = areMemoriesSimilar(a, b, { embeddingThreshold: 0.99 });
    expect(result.embeddingScore).toBeGreaterThan(0.99);
    expect(result.isDuplicate).toBe(true);
  });
});

describe("selectCanonical", () => {
  test("prefers the earliest-created record", () => {
    const older = {
      _id: new mongoose.Types.ObjectId(),
      createdAt: new Date("2026-01-01"),
      relatesTo: [],
      text: "short",
    };
    const newer = {
      _id: new mongoose.Types.ObjectId(),
      createdAt: new Date("2026-02-01"),
      relatesTo: [],
      text: "short",
    };
    expect(selectCanonical([newer, older])).toBe(older);
  });

  test("breaks createdAt ties using relationship count", () => {
    const sameDate = new Date("2026-01-01");
    const lessConnected = {
      _id: new mongoose.Types.ObjectId(),
      createdAt: sameDate,
      relatesTo: [],
      text: "short",
    };
    const moreConnected = {
      _id: new mongoose.Types.ObjectId(),
      createdAt: sameDate,
      relatesTo: [{ target: new mongoose.Types.ObjectId(), confidence: 90 }],
      text: "short",
    };
    expect(selectCanonical([lessConnected, moreConnected])).toBe(moreConnected);
  });
});

describe("buildDuplicateClusters", () => {
  test("groups transitively similar records into one cluster", () => {
    const records = [
      {
        _id: new mongoose.Types.ObjectId(),
        text: "I live in Delhi",
        embedding: [],
      },
      {
        _id: new mongoose.Types.ObjectId(),
        text: "My home city is Delhi",
        embedding: [],
      },
      {
        _id: new mongoose.Types.ObjectId(),
        text: "I currently stay in Delhi",
        embedding: [],
      },
      {
        _id: new mongoose.Types.ObjectId(),
        text: "The server needs a restart",
        embedding: [],
      },
    ];

    const clusters = buildDuplicateClusters(records, { textThreshold: 0.25 });
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(3);
  });

  test("returns no clusters when nothing is similar", () => {
    const records = [
      {
        _id: new mongoose.Types.ObjectId(),
        text: "Ship the report",
        embedding: [],
      },
      {
        _id: new mongoose.Types.ObjectId(),
        text: "Renew the domain",
        embedding: [],
      },
    ];
    expect(buildDuplicateClusters(records)).toHaveLength(0);
  });
});

describe("mergeCluster (Decision)", () => {
  test("dry run reports the merge without writing to the database", async () => {
    const older = await Decision.create({
      text: "I live in Delhi",
      sourceMeetingId: meetingA,
      organization: organizationId,
      createdAt: new Date("2026-01-01"),
    });
    const newer = await Decision.create({
      text: "My home city is Delhi",
      sourceMeetingId: meetingB,
      organization: organizationId,
      createdAt: new Date("2026-01-05"),
    });

    const summary = await mergeCluster("decision", [older, newer], {
      dryRun: true,
    });

    expect(summary.dryRun).toBe(true);
    expect(summary.canonicalId).toBe(older._id.toString());

    const reloadedNewer = await Decision.findById(newer._id);
    expect(reloadedNewer.supersededByMemory).toBeNull();
  });

  test("merges aliases, history, and relationships, preserving merged docs", async () => {
    const target = await Decision.create({
      text: "Unrelated related decision",
      sourceMeetingId: meetingC,
      organization: organizationId,
    });

    const canonical = await Decision.create({
      text: "I live in Delhi",
      sourceMeetingId: meetingA,
      organization: organizationId,
      createdAt: new Date("2026-01-01"),
      relatesTo: [{ target: target._id, confidence: 80 }],
    });
    const duplicate = await Decision.create({
      text: "My home city is Delhi",
      sourceMeetingId: meetingB,
      organization: organizationId,
      createdAt: new Date("2026-01-05"),
    });

    const summary = await mergeCluster("decision", [canonical, duplicate], {
      dryRun: false,
    });

    expect(summary.dryRun).toBe(false);
    expect(summary.mergedIds).toEqual([duplicate._id.toString()]);

    const reloadedCanonical = await Decision.findById(canonical._id);
    expect(reloadedCanonical.aliases).toContain("My home city is Delhi");
    expect(reloadedCanonical.mergedFrom).toHaveLength(1);
    expect(reloadedCanonical.mergedFrom[0].text).toBe("My home city is Delhi");
    // Pre-existing relationship should survive the merge.
    expect(
      reloadedCanonical.relatesTo.map((r) => r.target.toString()),
    ).toContain(target._id.toString());

    const reloadedDuplicate = await Decision.findById(duplicate._id);
    expect(reloadedDuplicate).not.toBeNull(); // never deleted
    expect(reloadedDuplicate.supersededByMemory.toString()).toBe(
      canonical._id.toString(),
    );
  });

  test("repoints edges from unrelated docs onto the canonical record", async () => {
    const canonical = await Decision.create({
      text: "I live in Delhi",
      sourceMeetingId: meetingA,
      organization: organizationId,
      createdAt: new Date("2026-01-01"),
    });
    const duplicate = await Decision.create({
      text: "My home city is Delhi",
      sourceMeetingId: meetingB,
      organization: organizationId,
      createdAt: new Date("2026-01-05"),
    });
    const bystander = await Decision.create({
      text: "Follow-up on housing stipend",
      sourceMeetingId: meetingC,
      organization: organizationId,
      relatesTo: [{ target: duplicate._id, confidence: 75 }],
    });

    await mergeCluster("decision", [canonical, duplicate], { dryRun: false });

    const reloadedBystander = await Decision.findById(bystander._id);
    const targets = reloadedBystander.relatesTo.map((r) => r.target.toString());
    expect(targets).toContain(canonical._id.toString());
    expect(targets).not.toContain(duplicate._id.toString());
  });
});

describe("mergeCluster (ActionItem) — conflict resolution", () => {
  test("resolves owner/status/dueDate conflicts and logs them", async () => {
    const canonical = await ActionItem.create({
      text: "Send the onboarding docs to new hires",
      sourceMeetingId: meetingA,
      organization: organizationId,
      createdAt: new Date("2026-01-01"),
      owner: "Unassigned",
      status: "open",
      dueDate: new Date("2026-03-10"),
    });
    const duplicate = await ActionItem.create({
      text: "Send onboarding documents to new hires",
      sourceMeetingId: meetingB,
      organization: organizationId,
      createdAt: new Date("2026-01-05"),
      owner: "Priya",
      status: "resolved",
      dueDate: new Date("2026-03-01"),
    });

    const summary = await mergeCluster("actionItem", [canonical, duplicate], {
      dryRun: false,
    });

    const fields = summary.conflicts.map((c) => c.field);
    expect(fields).toEqual(
      expect.arrayContaining(["owner", "status", "dueDate"]),
    );

    const reloaded = await ActionItem.findById(canonical._id);
    expect(reloaded.owner).toBe("Priya"); // real owner wins over "Unassigned"
    expect(reloaded.status).toBe("resolved"); // terminal status propagates
    expect(reloaded.dueDate.toISOString()).toBe(
      new Date("2026-03-01").toISOString(),
    ); // earliest due date kept
  });
});

describe("consolidateMemories (end-to-end)", () => {
  test("clusters and merges duplicate decisions for an organization", async () => {
    await Decision.create([
      {
        text: "I live in Delhi",
        sourceMeetingId: meetingA,
        organization: organizationId,
        createdAt: new Date("2026-01-01"),
      },
      {
        text: "My home city is Delhi",
        sourceMeetingId: meetingB,
        organization: organizationId,
        createdAt: new Date("2026-01-02"),
      },
      {
        text: "I currently stay in Delhi",
        sourceMeetingId: meetingC,
        organization: organizationId,
        createdAt: new Date("2026-01-03"),
      },
      {
        text: "Approved the new vendor contract",
        sourceMeetingId: meetingA,
        organization: organizationId,
      },
    ]);

    const report = await consolidateMemories({
      organization: organizationId,
      dryRun: false,
      models: ["decision"],
      textThreshold: 0.25,
    });

    expect(report.dryRun).toBe(false);
    expect(report.results.decision.clustersFound).toBe(1);
    expect(report.results.decision.merges[0].mergedIds).toHaveLength(2);

    const canonicalId = report.results.decision.merges[0].canonicalId;
    const canonical = await Decision.findById(canonicalId);
    expect(canonical.aliases).toHaveLength(2);

    const remainingActive = await Decision.find({
      organization: organizationId,
      supersededByMemory: null,
    });
    // 2 Delhi duplicates merged away, 1 canonical + 1 unrelated decision left
    expect(remainingActive).toHaveLength(2);
  });

  test("rejects unsupported memory types", async () => {
    await expect(
      consolidateMemories({ models: ["not_a_real_type"] }),
    ).rejects.toThrow(/Unsupported memory type/);
  });
});
