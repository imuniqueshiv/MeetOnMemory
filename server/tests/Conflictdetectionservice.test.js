import mongoose from "mongoose";
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import ConflictSet from "../models/conflictModel.js";
import { heuristicContradictionCheck } from "../utils/contradictionSignals.js";
import {
  isSameTopic,
  detectContradiction,
} from "../services/conflictDetection/ContradictionAnalyzer.js";
import { buildConflictClusters } from "../services/conflictDetection/ConflictAggregator.js";
import {
  detectConflicts,
  resolveConflictSet,
  listConflictSets,
} from "../services/conflictDetection/conflictDetectionService.js";

const organizationId = new mongoose.Types.ObjectId();
const meetingA = new mongoose.Types.ObjectId();
const meetingB = new mongoose.Types.ObjectId();
const meetingC = new mongoose.Types.ObjectId();

beforeAll(async () => {
  await mongoose.connect(`${process.env.TEST_MONGODB_URI}/conflict_detection`);
});

describe("heuristicContradictionCheck", () => {
  test("flags differing dates on the same topic as a contradiction", () => {
    const result = heuristicContradictionCheck(
      "Project deadline is July 15",
      "Project deadline is July 22",
    );
    expect(result.isContradiction).toBe(true);
    expect(result.signals.some((s) => s.type === "date")).toBe(true);
  });

  test("flags differing owners on the same topic as a contradiction", () => {
    const result = heuristicContradictionCheck(
      "Frontend owner is Alice",
      "Frontend owner is Bob",
    );
    expect(result.isContradiction).toBe(true);
    expect(result.signals.some((s) => s.type === "entity")).toBe(true);
  });

  test("does not flag unrelated statements", () => {
    const result = heuristicContradictionCheck(
      "Frontend owner is Alice",
      "The Q3 budget was approved",
    );
    expect(result.isContradiction).toBe(false);
  });

  test("does not flag identical/paraphrased statements (no differing values)", () => {
    const result = heuristicContradictionCheck(
      "The project deadline is set",
      "The project deadline was set",
    );
    expect(result.isContradiction).toBe(false);
  });
});

describe("isSameTopic", () => {
  test("uses lexical overlap when embeddings are absent", () => {
    const a = { text: "Database is PostgreSQL", embedding: [] };
    const b = { text: "Database migrated to MongoDB", embedding: [] };
    expect(isSameTopic(a, b)).toBe(true);
  });

  test("returns false for unrelated topics", () => {
    const a = { text: "Database is PostgreSQL", embedding: [] };
    const b = { text: "The venue for the offsite is booked", embedding: [] };
    expect(isSameTopic(a, b)).toBe(false);
  });
});

describe("detectContradiction (heuristic-only, useAI: false)", () => {
  test("detects a contradiction without calling the AI classifier", async () => {
    const a = { text: "Database is PostgreSQL", embedding: [] };
    const b = { text: "Database migrated to MongoDB", embedding: [] };
    const result = await detectContradiction(a, b, { useAI: false });
    expect(result.isContradiction).toBe(true);
    expect(result.source).toBe("heuristic");
  });

  test("falls back to the heuristic when the AI classifier returns null", async () => {
    const a = { text: "Frontend owner is Alice", embedding: [] };
    const b = { text: "Frontend owner is Bob", embedding: [] };
    const result = await detectContradiction(a, b, {
      useAI: true,
      classifyFn: async () => null,
    });
    expect(result.isContradiction).toBe(true);
    expect(result.source).toBe("heuristic");
  });

  test("defers to an AI 'entailment' classification even if the heuristic disagreed", async () => {
    const a = { text: "Frontend owner is Alice", embedding: [] };
    const b = { text: "Frontend owner is Bob", embedding: [] };
    const result = await detectContradiction(a, b, {
      useAI: true,
      classifyFn: async () => ({
        relation: "entailment",
        confidence: 90,
        explanation: "Same fact, different phrasing.",
      }),
    });
    expect(result.isContradiction).toBe(false);
    expect(result.source).toBe("ai");
  });

  test("respects a high minConfidence threshold", async () => {
    const a = { text: "Project deadline is July 15", embedding: [] };
    const b = { text: "Project deadline is July 22", embedding: [] };
    const result = await detectContradiction(a, b, {
      useAI: false,
      minConfidence: 99,
    });
    expect(result.isContradiction).toBe(false);
  });
});

describe("buildConflictClusters", () => {
  test("groups a contradicting pair and ignores unrelated records", async () => {
    const records = [
      {
        _id: new mongoose.Types.ObjectId(),
        text: "Project deadline is July 15",
        embedding: [],
      },
      {
        _id: new mongoose.Types.ObjectId(),
        text: "Project deadline is July 22",
        embedding: [],
      },
      {
        _id: new mongoose.Types.ObjectId(),
        text: "Renew the domain registration",
        embedding: [],
      },
    ];

    const { clusters, pairwiseByCluster } = await buildConflictClusters(
      records,
      { useAI: false },
    );

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(2);
    expect(pairwiseByCluster[0]).toHaveLength(1);
    expect(pairwiseByCluster[0][0].isContradiction).toBe(true);
  });

  test("returns no clusters when nothing conflicts", async () => {
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
    const { clusters } = await buildConflictClusters(records, { useAI: false });
    expect(clusters).toHaveLength(0);
  });
});

describe("detectConflicts (end-to-end)", () => {
  test("dry run reports conflicts without writing ConflictSet documents", async () => {
    await Decision.create([
      {
        text: "Database is PostgreSQL",
        sourceMeetingId: meetingA,
        organization: organizationId,
        createdAt: new Date("2026-01-01"),
      },
      {
        text: "Database migrated to MongoDB",
        sourceMeetingId: meetingB,
        organization: organizationId,
        createdAt: new Date("2026-01-05"),
      },
    ]);

    const report = await detectConflicts({
      organization: organizationId,
      dryRun: true,
      useAI: false,
      models: ["decision"],
    });

    expect(report.dryRun).toBe(true);
    expect(report.results.decision.conflictsFound).toBe(1);

    const stored = await ConflictSet.find({ organization: organizationId });
    expect(stored).toHaveLength(0);
  });

  test("persists a ConflictSet with member snapshots when dryRun is false", async () => {
    const [older, newer] = await Decision.create([
      {
        text: "Frontend owner is Alice",
        sourceMeetingId: meetingA,
        organization: organizationId,
        createdAt: new Date("2026-01-01"),
      },
      {
        text: "Frontend owner is Bob",
        sourceMeetingId: meetingB,
        organization: organizationId,
        createdAt: new Date("2026-01-05"),
      },
    ]);

    const report = await detectConflicts({
      organization: organizationId,
      dryRun: false,
      useAI: false,
      models: ["decision"],
    });

    expect(report.results.decision.conflictsFound).toBe(1);

    const stored = await ConflictSet.find({ organization: organizationId });
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe("open");
    expect(stored[0].memberIds.map((id) => id.toString()).sort()).toEqual(
      [older._id.toString(), newer._id.toString()].sort(),
    );
    expect(stored[0].memberSnapshots).toHaveLength(2);
  });

  test("re-scanning updates the existing open conflict instead of duplicating it", async () => {
    await Decision.create([
      {
        text: "Frontend owner is Alice",
        sourceMeetingId: meetingA,
        organization: organizationId,
      },
      {
        text: "Frontend owner is Bob",
        sourceMeetingId: meetingB,
        organization: organizationId,
      },
    ]);

    await detectConflicts({
      organization: organizationId,
      dryRun: false,
      useAI: false,
      models: ["decision"],
    });
    await detectConflicts({
      organization: organizationId,
      dryRun: false,
      useAI: false,
      models: ["decision"],
    });

    const stored = await ConflictSet.find({ organization: organizationId });
    expect(stored).toHaveLength(1);
  });

  test("rejects unsupported memory types", async () => {
    await expect(
      detectConflicts({ models: ["not_a_real_type"] }),
    ).rejects.toThrow(/Unsupported memory type/);
  });
});

describe("resolveConflictSet", () => {
  test("kept_member marks the losing memory as superseded, preserving its text", async () => {
    const [older, newer] = await Decision.create([
      {
        text: "Frontend owner is Alice",
        sourceMeetingId: meetingA,
        organization: organizationId,
      },
      {
        text: "Frontend owner is Bob",
        sourceMeetingId: meetingB,
        organization: organizationId,
      },
    ]);

    await detectConflicts({
      organization: organizationId,
      dryRun: false,
      useAI: false,
      models: ["decision"],
    });

    const [conflict] = await listConflictSets("decision", {
      organization: organizationId,
      status: "open",
    });
    expect(conflict).toBeTruthy();

    const resolverId = new mongoose.Types.ObjectId();
    const resolved = await resolveConflictSet(conflict._id, {
      resolutionType: "kept_member",
      keptMemoryId: newer._id,
      note: "Bob is correct as of the latest meeting.",
      resolvedBy: resolverId,
    });

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolution.type).toBe("kept_member");
    expect(resolved.resolution.keptMemoryId.toString()).toBe(
      newer._id.toString(),
    );

    const reloadedOlder = await Decision.findById(older._id);
    expect(reloadedOlder.status).toBe("superseded");
    expect(reloadedOlder.supersededByMemory.toString()).toBe(
      newer._id.toString(),
    );
    // Text is preserved, never overwritten — this isn't a merge.
    expect(reloadedOlder.text).toBe("Frontend owner is Alice");

    const reloadedNewer = await Decision.findById(newer._id);
    expect(reloadedNewer.status).not.toBe("superseded");
  });

  test("custom_value resolution does not mutate any member record", async () => {
    const [a, b] = await ActionItem.create([
      {
        text: "Ship date is March 1",
        sourceMeetingId: meetingA,
        organization: organizationId,
      },
      {
        text: "Ship date is March 10",
        sourceMeetingId: meetingC,
        organization: organizationId,
      },
    ]);

    await detectConflicts({
      organization: organizationId,
      dryRun: false,
      useAI: false,
      models: ["actionItem"],
    });

    const [conflict] = await listConflictSets("actionItem", {
      organization: organizationId,
      status: "open",
    });

    const resolved = await resolveConflictSet(conflict._id, {
      resolutionType: "custom_value",
      customValue: "Ship date is March 5 (confirmed with the client)",
    });

    expect(resolved.resolution.type).toBe("custom_value");
    expect(resolved.status).toBe("resolved");

    const reloadedA = await ActionItem.findById(a._id);
    const reloadedB = await ActionItem.findById(b._id);
    expect(reloadedA.status).not.toBe("superseded");
    expect(reloadedB.status).not.toBe("superseded");
  });

  test("dismissed resolution marks the conflict dismissed without touching members", async () => {
    const [a, b] = await Decision.create([
      {
        text: "Database is PostgreSQL",
        sourceMeetingId: meetingA,
        organization: organizationId,
      },
      {
        text: "Database migrated to MongoDB",
        sourceMeetingId: meetingB,
        organization: organizationId,
      },
    ]);

    await detectConflicts({
      organization: organizationId,
      dryRun: false,
      useAI: false,
      models: ["decision"],
    });

    const [conflict] = await listConflictSets("decision", {
      organization: organizationId,
      status: "open",
    });

    const resolved = await resolveConflictSet(conflict._id, {
      resolutionType: "dismissed",
      note: "Not actually a conflict — sequential migration steps.",
    });

    expect(resolved.status).toBe("dismissed");

    const reloadedA = await Decision.findById(a._id);
    const reloadedB = await Decision.findById(b._id);
    expect(reloadedA.status).not.toBe("superseded");
    expect(reloadedB.status).not.toBe("superseded");
  });

  test("rejects resolving an already-resolved conflict", async () => {
    const [, newer] = await Decision.create([
      {
        text: "Frontend owner is Alice",
        sourceMeetingId: meetingA,
        organization: organizationId,
      },
      {
        text: "Frontend owner is Bob",
        sourceMeetingId: meetingB,
        organization: organizationId,
      },
    ]);

    await detectConflicts({
      organization: organizationId,
      dryRun: false,
      useAI: false,
      models: ["decision"],
    });

    const [conflict] = await listConflictSets("decision", {
      organization: organizationId,
      status: "open",
    });

    await resolveConflictSet(conflict._id, {
      resolutionType: "kept_member",
      keptMemoryId: newer._id,
    });

    await expect(
      resolveConflictSet(conflict._id, { resolutionType: "dismissed" }),
    ).rejects.toThrow(/already/);
  });

  test("rejects an invalid keptMemoryId not belonging to the conflict", async () => {
    await Decision.create([
      {
        text: "Frontend owner is Alice",
        sourceMeetingId: meetingA,
        organization: organizationId,
      },
      {
        text: "Frontend owner is Bob",
        sourceMeetingId: meetingB,
        organization: organizationId,
      },
    ]);

    await detectConflicts({
      organization: organizationId,
      dryRun: false,
      useAI: false,
      models: ["decision"],
    });

    const [conflict] = await listConflictSets("decision", {
      organization: organizationId,
      status: "open",
    });

    await expect(
      resolveConflictSet(conflict._id, {
        resolutionType: "kept_member",
        keptMemoryId: new mongoose.Types.ObjectId(),
      }),
    ).rejects.toThrow(/must reference one of this conflict set's members/);
  });
});

describe("listConflictSets input validation", () => {
  test("ignores non-string status values", async () => {
    await expect(
      listConflictSets("decision", {
        organization: organizationId,
        status: { $ne: "open" },
      }),
    ).resolves.toEqual(expect.any(Array));
  });

  test("uses the default limit for invalid values", async () => {
    await expect(
      listConflictSets("decision", {
        organization: organizationId,
        limit: { $gt: 100 },
      }),
    ).resolves.toEqual(expect.any(Array));
  });
});
