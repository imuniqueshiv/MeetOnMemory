import mongoose from "mongoose";
import "../server.js"; // triggers connectDB() against the in-memory Mongo set up in tests/setup.js
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import {
  evaluateLifecycleState,
  transitionLifecycleState,
  restoreMemory,
  runLifecycleSweep,
} from "../services/memoryLifecycleService.js";
import { recordMemoryAccess } from "../services/importanceScoringService.js";

function makeMeetingId() {
  return new mongoose.Types.ObjectId();
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

const POLICY = {
  dormantAfterDays: 30,
  archivedAfterDays: 90,
  expiredAfterDays: 365,
  minImportanceScoreToProtect: 70,
  hardDeleteExpired: false,
};

describe("memoryLifecycleService", () => {
  describe("evaluateLifecycleState (pure logic)", () => {
    it("keeps a recently accessed memory active", () => {
      const { state } = evaluateLifecycleState(
        {
          lifecycleState: "active",
          lastAccessedAt: daysAgo(1),
          importanceScore: 10,
        },
        POLICY,
      );
      expect(state).toBe("active");
    });

    it("marks a memory dormant after the dormant threshold", () => {
      const { state, reason } = evaluateLifecycleState(
        {
          lifecycleState: "active",
          lastAccessedAt: daysAgo(35),
          importanceScore: 10,
        },
        POLICY,
      );
      expect(state).toBe("dormant");
      expect(reason).toMatch(/Inactive for/);
    });

    it("marks a memory archived after the archived threshold", () => {
      const { state } = evaluateLifecycleState(
        {
          lifecycleState: "dormant",
          lastAccessedAt: daysAgo(100),
          importanceScore: 10,
        },
        POLICY,
      );
      expect(state).toBe("archived");
    });

    it("protects high-importance memories from archival despite inactivity", () => {
      const { state } = evaluateLifecycleState(
        {
          lifecycleState: "active",
          lastAccessedAt: daysAgo(200),
          importanceScore: 85,
        },
        POLICY,
      );
      expect(state).not.toBe("archived");
    });

    it("marks an already-archived memory expired after the expiry threshold", () => {
      const { state } = evaluateLifecycleState(
        {
          lifecycleState: "archived",
          lastAccessedAt: daysAgo(400),
          importanceScore: 10,
        },
        POLICY,
      );
      expect(state).toBe("expired");
    });

    it("treats expired as terminal (never auto-transitions further)", () => {
      const { state, reason } = evaluateLifecycleState(
        {
          lifecycleState: "expired",
          lastAccessedAt: daysAgo(1000),
          importanceScore: 0,
        },
        POLICY,
      );
      expect(state).toBe("expired");
      expect(reason).toBeNull();
    });
  });

  describe("transitionLifecycleState", () => {
    it("persists a state change and appends to lifecycleHistory", async () => {
      const decision = await Decision.create({
        text: "Adopt trunk-based development",
        sourceMeetingId: makeMeetingId(),
      });

      const updated = await transitionLifecycleState(decision, "archived", {
        reason: "test archive",
        triggeredBy: "system",
      });

      expect(updated.lifecycleState).toBe("archived");
      expect(updated.archivedAt).toBeInstanceOf(Date);
      expect(updated.lifecycleHistory).toHaveLength(1);
      expect(updated.lifecycleHistory[0]).toMatchObject({
        from: "active",
        to: "archived",
        reason: "test archive",
      });
    });

    it("is a no-op when the target state matches the current state", async () => {
      const item = await ActionItem.create({
        text: "Follow up with vendor",
        sourceMeetingId: makeMeetingId(),
      });

      const updated = await transitionLifecycleState(item, "active");
      expect(updated.lifecycleHistory).toHaveLength(0);
    });

    it("rejects an unknown lifecycle state", async () => {
      const item = await ActionItem.create({
        text: "Draft the RFC",
        sourceMeetingId: makeMeetingId(),
      });

      await expect(transitionLifecycleState(item, "on-hold")).rejects.toThrow(
        "Unknown lifecycle state",
      );
    });
  });

  describe("restoreMemory", () => {
    it("brings an archived memory back to active and logs the restoration", async () => {
      const decision = await Decision.create({
        text: "Retire the legacy API",
        sourceMeetingId: makeMeetingId(),
        lifecycleState: "archived",
      });

      const restored = await restoreMemory("decision", decision._id, {
        triggeredBy: "user-123",
        reason: "Manually restored",
      });

      expect(restored.lifecycleState).toBe("active");
      expect(restored.lifecycleHistory).toHaveLength(1);
      expect(restored.lifecycleHistory[0].triggeredBy).toBe("user-123");
    });

    it("returns null for a non-existent id", async () => {
      const result = await restoreMemory(
        "decision",
        new mongoose.Types.ObjectId(),
      );
      expect(result).toBeNull();
    });
  });

  describe("recordMemoryAccess auto-restores dormant/archived memories", () => {
    it("brings a dormant memory back to active when it is accessed", async () => {
      const item = await ActionItem.create({
        text: "Migrate to the new CI provider",
        sourceMeetingId: makeMeetingId(),
        lifecycleState: "dormant",
      });

      const accessed = await recordMemoryAccess("actionItem", item._id);

      expect(accessed.lifecycleState).toBe("active");
      expect(accessed.lifecycleHistory).toHaveLength(1);
      expect(accessed.lifecycleHistory[0].reason).toMatch(/Restored/);
    });
  });

  describe("runLifecycleSweep", () => {
    it("transitions inactive memories to dormant/archived within an organization", async () => {
      const organization = new mongoose.Types.ObjectId();
      const otherOrg = new mongoose.Types.ObjectId();

      const [dormantCandidate, archivedCandidate] = await Decision.create([
        {
          text: "Should become dormant",
          sourceMeetingId: makeMeetingId(),
          organization,
          lastAccessedAt: daysAgo(40),
        },
        {
          text: "Should become archived",
          sourceMeetingId: makeMeetingId(),
          organization,
          lifecycleState: "dormant",
          lastAccessedAt: daysAgo(120),
        },
      ]);

      await Decision.create({
        text: "Other org, also inactive",
        sourceMeetingId: makeMeetingId(),
        organization: otherOrg,
        lastAccessedAt: daysAgo(400),
      });

      const summary = await runLifecycleSweep({
        organization,
        policyOverrides: POLICY,
      });

      expect(summary.transitions.toDormant).toBeGreaterThanOrEqual(1);
      expect(summary.transitions.toArchived).toBeGreaterThanOrEqual(1);

      const refreshedDormant = await Decision.findById(dormantCandidate._id);
      const refreshedArchived = await Decision.findById(archivedCandidate._id);

      expect(refreshedDormant.lifecycleState).toBe("dormant");
      expect(refreshedArchived.lifecycleState).toBe("archived");

      // Untouched by this sweep since it was scoped to `organization`.
      const otherOrgDoc = await Decision.findOne({ organization: otherOrg });
      expect(otherOrgDoc.lifecycleState).toBe("active");
    });

    it("never hard-deletes expired memories unless explicitly enabled", async () => {
      const organization = new mongoose.Types.ObjectId();
      const expiredCandidate = await Decision.create({
        text: "Long expired",
        sourceMeetingId: makeMeetingId(),
        organization,
        lifecycleState: "archived",
        lastAccessedAt: daysAgo(500),
      });

      await runLifecycleSweep({ organization, policyOverrides: POLICY });

      const stillThere = await Decision.findById(expiredCandidate._id);
      expect(stillThere).not.toBeNull();
      expect(stillThere.lifecycleState).toBe("expired");
    });
  });
});
