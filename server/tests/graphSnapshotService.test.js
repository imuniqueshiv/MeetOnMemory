import mongoose from "mongoose";
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import Meeting from "../models/meetingModel.js";
import User from "../models/userModel.js";
import GraphSnapshot from "../models/graphSnapshotModel.js";
import {
  captureSnapshot,
  listSnapshots,
  getSnapshotById,
  diffSnapshots,
} from "../services/graphSnapshotService.js";

async function makeMeeting(overrides = {}) {
  const owner = await User.create({
    name: "Owner",
    email: `owner-${new mongoose.Types.ObjectId()}@example.com`,
    password: "hashedpw123",
  });

  return Meeting.create({
    title: "Q3 Planning",
    transcript: "We discussed the roadmap.",
    uploadedBy: owner._id,
    date: new Date(),
    ...overrides,
  });
}

describe("services/graphSnapshotService", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  });
  describe("captureSnapshot", () => {
    it("persists a snapshot with node/edge counts matching the live graph", async () => {
      const meeting = await makeMeeting();
      const decision = await Decision.create({
        text: "Adopt hybrid retrieval",
        sourceMeetingId: meeting._id,
      });
      const actionItem = await ActionItem.create({
        text: "Write migration guide",
        sourceMeetingId: meeting._id,
      });

      const { snapshot, skipped } = await captureSnapshot(null, {
        trigger: "meeting_processed",
        sourceMeetingId: meeting._id,
      });

      expect(skipped).toBe(false);
      expect(snapshot).toBeTruthy();
      // 1 decision + 1 action item + 1 meeting node
      expect(snapshot.metadata.nodeCount).toBe(3);
      expect(snapshot.metadata.decisionCount).toBe(1);
      expect(snapshot.metadata.actionItemCount).toBe(1);
      // decision<->meeting and actionItem<->meeting
      expect(snapshot.metadata.edgeCount).toBe(2);

      const keys = snapshot.nodes.map((n) => n.refId.toString());
      expect(keys).toEqual(
        expect.arrayContaining([
          decision._id.toString(),
          actionItem._id.toString(),
        ]),
      );
    });

    it("skips writing a duplicate snapshot when the graph hasn't changed", async () => {
      const meeting = await makeMeeting();
      await Decision.create({
        text: "Ship v2",
        sourceMeetingId: meeting._id,
      });

      const first = await captureSnapshot(null, { trigger: "manual" });
      expect(first.skipped).toBe(false);

      const second = await captureSnapshot(null, { trigger: "manual" });
      expect(second.skipped).toBe(true);
      expect(second.snapshot).toBeNull();

      const count = await GraphSnapshot.countDocuments({ organization: null });
      expect(count).toBe(1);
    });

    it("captures a new snapshot once the graph actually changes", async () => {
      const meeting = await makeMeeting();
      await Decision.create({ text: "Ship v2", sourceMeetingId: meeting._id });
      await captureSnapshot(null, { trigger: "manual" });

      await Decision.create({ text: "Ship v3", sourceMeetingId: meeting._id });
      const second = await captureSnapshot(null, { trigger: "manual" });

      expect(second.skipped).toBe(false);
      const count = await GraphSnapshot.countDocuments({ organization: null });
      expect(count).toBe(2);
    });

    it("force captures even when nothing changed", async () => {
      const meeting = await makeMeeting();
      await Decision.create({ text: "Ship v2", sourceMeetingId: meeting._id });
      await captureSnapshot(null, { trigger: "manual" });

      const forced = await captureSnapshot(null, {
        trigger: "manual",
        force: true,
      });
      expect(forced.skipped).toBe(false);

      const count = await GraphSnapshot.countDocuments({ organization: null });
      expect(count).toBe(2);
    });

    it("scopes snapshots to the given organization", async () => {
      const orgA = new mongoose.Types.ObjectId();
      const orgB = new mongoose.Types.ObjectId();
      const meeting = await makeMeeting();

      await Decision.create({
        text: "Org A decision",
        sourceMeetingId: meeting._id,
        organization: orgA,
      });
      await Decision.create({
        text: "Org B decision",
        sourceMeetingId: meeting._id,
        organization: orgB,
      });

      const { snapshot } = await captureSnapshot(orgA, { trigger: "manual" });
      const decisionTexts = snapshot.nodes
        .filter((n) => n.type === "decision")
        .map((n) => n.text);

      expect(decisionTexts).toEqual(["Org A decision"]);
    });
  });

  describe("listSnapshots", () => {
    it("returns snapshots newest first without node/edge payloads", async () => {
      const meeting = await makeMeeting();
      await Decision.create({ text: "D1", sourceMeetingId: meeting._id });
      await captureSnapshot(null, { trigger: "manual" });

      await Decision.create({ text: "D2", sourceMeetingId: meeting._id });
      await captureSnapshot(null, { trigger: "manual" });

      const snapshots = await listSnapshots(null, { limit: 10 });
      expect(snapshots.length).toBe(2);
      expect(snapshots[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        snapshots[1].createdAt.getTime(),
      );
      expect(snapshots[0].nodes).toBeUndefined();
      expect(snapshots[0].edges).toBeUndefined();
    });
  });

  describe("getSnapshotById", () => {
    it("returns the full snapshot including nodes and edges", async () => {
      const meeting = await makeMeeting();
      await Decision.create({ text: "D1", sourceMeetingId: meeting._id });
      const { snapshot } = await captureSnapshot(null, { trigger: "manual" });

      const fetched = await getSnapshotById(snapshot._id, null);
      expect(fetched).toBeTruthy();
      expect(fetched.nodes.length).toBe(snapshot.nodes.length);
    });

    it("does not return a snapshot belonging to another organization", async () => {
      const orgA = new mongoose.Types.ObjectId();
      const orgB = new mongoose.Types.ObjectId();
      const meeting = await makeMeeting();
      await Decision.create({
        text: "D1",
        sourceMeetingId: meeting._id,
        organization: orgA,
      });
      const { snapshot } = await captureSnapshot(orgA, { trigger: "manual" });

      const fetched = await getSnapshotById(snapshot._id, orgB);
      expect(fetched).toBeNull();
    });
  });

  describe("diffSnapshots", () => {
    it("detects added nodes/edges between two points in time", async () => {
      const meeting = await makeMeeting();
      const d1 = await Decision.create({
        text: "D1",
        sourceMeetingId: meeting._id,
      });
      const before = (await captureSnapshot(null, { trigger: "manual" }))
        .snapshot;

      const d2 = await Decision.create({
        text: "D2",
        sourceMeetingId: meeting._id,
        relatesTo: [{ target: d1._id, confidence: 90 }],
      });
      const after = (await captureSnapshot(null, { trigger: "manual" }))
        .snapshot;

      const diff = await diffSnapshots(before._id, after._id, null);

      expect(diff.summary.nodesAdded).toBe(1);
      expect(diff.nodes.added[0].refId.toString()).toBe(d2._id.toString());
      // new decision<->decision edge, plus its meeting edge
      expect(diff.summary.edgesAdded).toBe(2);
      expect(diff.summary.nodesRemoved).toBe(0);
    });

    it("detects modified node fields (e.g. status changes)", async () => {
      const meeting = await makeMeeting();
      const item = await ActionItem.create({
        text: "Write docs",
        status: "open",
        sourceMeetingId: meeting._id,
      });
      const before = (await captureSnapshot(null, { trigger: "manual" }))
        .snapshot;

      item.status = "resolved";
      await item.save();
      const after = (
        await captureSnapshot(null, {
          trigger: "manual",
          force: true,
        })
      ).snapshot;

      const diff = await diffSnapshots(before._id, after._id, null);

      expect(diff.summary.nodesModified).toBe(1);
      expect(diff.nodes.modified[0].changedFields).toContain("status");
      expect(diff.nodes.modified[0].before.status).toBe("open");
      expect(diff.nodes.modified[0].after.status).toBe("resolved");
    });

    it("throws when a snapshot doesn't belong to the requesting organization", async () => {
      const orgA = new mongoose.Types.ObjectId();
      const orgB = new mongoose.Types.ObjectId();
      const meeting = await makeMeeting();
      await Decision.create({
        text: "D1",
        sourceMeetingId: meeting._id,
        organization: orgA,
      });
      const snap = (await captureSnapshot(orgA, { trigger: "manual" }))
        .snapshot;

      await expect(diffSnapshots(snap._id, snap._id, orgB)).rejects.toThrow(
        /not found/i,
      );
    });
  });
});
