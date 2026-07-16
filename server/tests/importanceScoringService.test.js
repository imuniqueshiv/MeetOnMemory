import mongoose from "mongoose";
import "../server.js"; // triggers connectDB() against the in-memory Mongo set up in tests/setup.js
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import {
  applyImportanceScore,
  recalculateImportanceById,
  recalculateAllImportanceScores,
  recordMemoryAccess,
  recordMemoryFeedback,
} from "../services/importanceScoringService.js";

function makeMeetingId() {
  return new mongoose.Types.ObjectId();
}

describe("importanceScoringService", () => {
  describe("applyImportanceScore / recalculateImportanceById", () => {
    it("computes and persists a score + factor breakdown on a decision", async () => {
      const decision = await Decision.create({
        text: "Adopt trunk-based development",
        sourceMeetingId: makeMeetingId(),
      });

      expect(decision.importanceScore).toBe(0);

      const updated = await applyImportanceScore(decision);

      expect(updated.importanceScore).toBeGreaterThan(0);
      expect(updated.importanceUpdatedAt).toBeInstanceOf(Date);
      expect(updated.importanceFactors.recency).toBeGreaterThan(0);
    });

    it("recalculates by id for an action item", async () => {
      const item = await ActionItem.create({
        text: "Follow up with vendor",
        sourceMeetingId: makeMeetingId(),
      });

      const updated = await recalculateImportanceById("actionItem", item._id);
      expect(updated.importanceScore).toBeGreaterThan(0);
    });

    it("returns null for a non-existent id", async () => {
      const result = await recalculateImportanceById(
        "actionItem",
        new mongoose.Types.ObjectId(),
      );
      expect(result).toBeNull();
    });

    it("throws for an unknown memory type", async () => {
      await expect(
        recalculateImportanceById("meeting", new mongoose.Types.ObjectId()),
      ).rejects.toThrow("Unknown memory type");
    });
  });

  describe("recordMemoryAccess", () => {
    it("increments accessCount, sets lastAccessedAt, and refreshes the score", async () => {
      const item = await ActionItem.create({
        text: "Draft the RFC",
        sourceMeetingId: makeMeetingId(),
      });

      const first = await recordMemoryAccess("actionItem", item._id);
      expect(first.accessCount).toBe(1);
      expect(first.lastAccessedAt).toBeInstanceOf(Date);

      const second = await recordMemoryAccess("actionItem", item._id);
      expect(second.accessCount).toBe(2);
    });

    it("never throws, even for a bad id", async () => {
      const result = await recordMemoryAccess("actionItem", "not-a-valid-id");
      expect(result).toBeNull();
    });
  });

  describe("recordMemoryFeedback", () => {
    it("accumulates feedback and increases userFeedback factor toward 100 for good ratings", async () => {
      const decision = await Decision.create({
        text: "Migrate to the new CI provider",
        sourceMeetingId: makeMeetingId(),
      });

      const afterFirst = await recordMemoryFeedback(
        "decision",
        decision._id,
        5,
      );
      expect(afterFirst.feedbackCount).toBe(1);
      expect(afterFirst.feedbackScore).toBe(5);
      expect(afterFirst.importanceFactors.userFeedback).toBe(100);

      const afterSecond = await recordMemoryFeedback(
        "decision",
        decision._id,
        1,
      );
      expect(afterSecond.feedbackCount).toBe(2);
      expect(afterSecond.feedbackScore).toBe(6);
      // average rating is now 3 -> neutral 50
      expect(afterSecond.importanceFactors.userFeedback).toBe(50);
    });

    it("rejects out-of-range ratings", async () => {
      const decision = await Decision.create({
        text: "Retire the legacy API",
        sourceMeetingId: makeMeetingId(),
      });

      await expect(
        recordMemoryFeedback("decision", decision._id, 7),
      ).rejects.toThrow("between 1 and 5");
    });
  });

  describe("recalculateAllImportanceScores", () => {
    it("recomputes scores for every decision and action item in an organization", async () => {
      const organization = new mongoose.Types.ObjectId();
      const otherOrg = new mongoose.Types.ObjectId();

      await Decision.create([
        { text: "Decision A", sourceMeetingId: makeMeetingId(), organization },
        { text: "Decision B", sourceMeetingId: makeMeetingId(), organization },
        {
          text: "Other org decision",
          sourceMeetingId: makeMeetingId(),
          organization: otherOrg,
        },
      ]);
      await ActionItem.create({
        text: "Action A",
        sourceMeetingId: makeMeetingId(),
        organization,
      });

      const results = await recalculateAllImportanceScores({ organization });

      expect(results.decisions).toBe(2);
      expect(results.actionItems).toBe(1);

      const recalculated = await Decision.find({ organization });
      recalculated.forEach((d) => {
        expect(d.importanceScore).toBeGreaterThan(0);
        expect(d.importanceUpdatedAt).toBeInstanceOf(Date);
      });
    });
  });
});
