/**
 * Regression tests for Issue #1159 — the agenda timer persisted nothing.
 *
 * `agendaTimerController` wrote `status`, `startedAt`, `completedAt` and
 * `actualDuration` onto agenda subdocuments, and `agendaProgress` onto the
 * meeting. None of those were schema paths, and Mongoose is strict by default,
 * so every assignment was discarded before the save.
 *
 * The critical property of this suite is that **every assertion goes through a
 * save/reload cycle**. `agendaPacingAuthorization.test.js` and
 * `meetingHealth.test.js` both build agenda items as plain object literals and
 * never persist them, which is exactly why a feature that saved nothing looked
 * fine for as long as it did. A test that trusts an in-memory subdocument
 * proves nothing here: `item.status = "active"` sets a plain JS property that
 * reads back correctly and is dropped on `toObject()`.
 *
 * Confirmed load-bearing: against `main`'s model, controller, routes and
 * ordering util, 23 of these 26 fail.
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import mongoose from "mongoose";

let currentUser = null;

jest.unstable_mockModule("../middleware/userAuth.js", () => ({
  default: (req, res, next) => {
    if (!currentUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    req.user = currentUser;
    next();
  },
}));

const { default: agendaTimerRoutes } =
  await import("../routes/agendaTimerRoutes.js");
const { default: Meeting } = await import("../models/meetingModel.js");
const { normalizeAgendaItems } = await import("../utils/agendaOrdering.js");

const ORG_A = new mongoose.Types.ObjectId();
const ORG_B = new mongoose.Types.ObjectId();

const organizer = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "member",
};
const adminInOrgA = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "admin",
};
const viewerInOrgA = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_A,
  role: "guest",
};
const adminInOrgB = {
  _id: new mongoose.Types.ObjectId(),
  organization: ORG_B,
  role: "owner", // privileged — in a different tenant
};

let app;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }

  app = express();
  app.use(express.json());
  app.use("/api/meetings/timer", agendaTimerRoutes);
});

beforeEach(() => {
  currentUser = organizer;
});

const seedMeeting = async () =>
  Meeting.create({
    uploadedBy: organizer._id,
    organization: ORG_A,
    title: "Sprint review",
    date: new Date(),
    agendaItems: [
      { text: "Opening", duration: 5 },
      { text: "Demo", duration: 20 },
      { text: "Retro", duration: 10 },
    ],
  });

/** Reloads from the database — the only view of state this suite trusts. */
const reload = (id) => Meeting.findById(id);

const start = (meeting, item) =>
  request(app).put(
    `/api/meetings/timer/${meeting._id}/agenda/${item._id}/start`,
  );
const stop = (meeting, item) =>
  request(app).put(
    `/api/meetings/timer/${meeting._id}/agenda/${item._id}/stop`,
  );
const skip = (meeting, item) =>
  request(app).put(
    `/api/meetings/timer/${meeting._id}/agenda/${item._id}/skip`,
  );

// ───────────────────────────────────────────────────────────────────────────
describe("schema", () => {
  it("declares every field the timer writes", () => {
    const paths = Object.keys(Meeting.schema.path("agendaItems").schema.paths);

    expect(paths).toEqual(
      expect.arrayContaining([
        "status",
        "startedAt",
        "completedAt",
        "actualDuration",
      ]),
    );
    expect(Meeting.schema.path("agendaProgress")).toBeDefined();
  });

  it("defaults a new item to pending with a zeroed clock", async () => {
    const meeting = await seedMeeting();
    const reloaded = await reload(meeting._id);

    expect(reloaded.agendaItems[0].status).toBe("pending");
    expect(reloaded.agendaItems[0].actualDuration).toBe(0);
    expect(reloaded.agendaItems[0].startedAt).toBeNull();
    expect(reloaded.agendaProgress).toBe("not_started");
  });

  it("survives the pre-validate normalization hook", async () => {
    // `meetingSchema.pre("validate")` rebuilds `agendaItems` through
    // `normalizeAgendaItems` on every modification. If that ever stops
    // preserving unknown fields, the timer state is stripped on save and this
    // whole feature silently regresses to its previous behaviour.
    const meeting = await seedMeeting();
    const item = meeting.agendaItems[0];
    item.status = "active";
    item.actualDuration = 4321;
    meeting.title = "Renamed, forcing another save";
    await meeting.save();

    const reloaded = await reload(meeting._id);
    expect(reloaded.agendaItems[0].status).toBe("active");
    expect(reloaded.agendaItems[0].actualDuration).toBe(4321);
  });

  it("normalizeAgendaItems preserves timer fields while reordering", () => {
    const out = normalizeAgendaItems([
      { text: "Second", position: 1, status: "completed", actualDuration: 900 },
      { text: "First", position: 0, status: "active", actualDuration: 100 },
    ]);

    expect(out.map((i) => i.text)).toEqual(["First", "Second"]);
    expect(out[0]).toMatchObject({ status: "active", actualDuration: 100 });
    expect(out[1]).toMatchObject({ status: "completed", actualDuration: 900 });
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("PUT .../start", () => {
  it("persists active status and a start marker", async () => {
    const meeting = await seedMeeting();

    const res = await start(meeting, meeting.agendaItems[0]).expect(200);
    expect(res.body.item.status).toBe("active");

    const reloaded = await reload(meeting._id);
    expect(reloaded.agendaItems[0].status).toBe("active");
    expect(reloaded.agendaItems[0].startedAt).toBeInstanceOf(Date);
    expect(reloaded.agendaProgress).toBe("in_progress");
  });

  it("banks the elapsed time of the item it interrupts", async () => {
    const meeting = await seedMeeting();
    const [first, second] = meeting.agendaItems;

    await start(meeting, first).expect(200);

    // Backdate the start so there is a measurable interval without sleeping.
    await Meeting.updateOne(
      { _id: meeting._id, "agendaItems._id": first._id },
      { $set: { "agendaItems.$.startedAt": new Date(Date.now() - 90_000) } },
    );

    await start(meeting, second).expect(200);

    const reloaded = await reload(meeting._id);
    const interrupted = reloaded.agendaItems.id(first._id);

    expect(interrupted.status).toBe("pending");
    // Against `main` this was 0 — the interrupted item's time was discarded
    // with a comment saying so.
    expect(interrupted.actualDuration).toBeGreaterThanOrEqual(89_000);
    expect(interrupted.startedAt).toBeNull();
    expect(reloaded.agendaItems.id(second._id).status).toBe("active");
  });

  it("does not reset the clock when restarting the running item", async () => {
    const meeting = await seedMeeting();
    const [first] = meeting.agendaItems;

    await start(meeting, first).expect(200);
    await Meeting.updateOne(
      { _id: meeting._id, "agendaItems._id": first._id },
      { $set: { "agendaItems.$.startedAt": new Date(Date.now() - 60_000) } },
    );
    await start(meeting, first).expect(200);

    const reloaded = await reload(meeting._id);
    const item = reloaded.agendaItems.id(first._id);

    expect(item.status).toBe("active");
    expect(item.actualDuration).toBeGreaterThanOrEqual(59_000);
  });

  it("404s for an unknown agenda item", async () => {
    const meeting = await seedMeeting();

    await request(app)
      .put(
        `/api/meetings/timer/${meeting._id}/agenda/${new mongoose.Types.ObjectId()}/start`,
      )
      .expect(404);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("PUT .../stop", () => {
  it("completes an item that was started", async () => {
    const meeting = await seedMeeting();
    const [first] = meeting.agendaItems;

    await start(meeting, first).expect(200);
    // Against `main` this was a guaranteed 400: `status` never persisted, so
    // the reloaded item was always `undefined` at the guard.
    await stop(meeting, first).expect(200);

    const reloaded = await reload(meeting._id);
    const item = reloaded.agendaItems.id(first._id);

    expect(item.status).toBe("completed");
    expect(item.completedAt).toBeInstanceOf(Date);
    expect(item.startedAt).toBeNull();
    expect(Number.isFinite(item.actualDuration)).toBe(true);
  });

  it("accumulates across a stop / restart / stop cycle", async () => {
    const meeting = await seedMeeting();
    const [first] = meeting.agendaItems;

    await start(meeting, first);
    await Meeting.updateOne(
      { _id: meeting._id, "agendaItems._id": first._id },
      { $set: { "agendaItems.$.startedAt": new Date(Date.now() - 30_000) } },
    );
    await stop(meeting, first).expect(200);

    await start(meeting, first).expect(200);
    await Meeting.updateOne(
      { _id: meeting._id, "agendaItems._id": first._id },
      { $set: { "agendaItems.$.startedAt": new Date(Date.now() - 20_000) } },
    );
    await stop(meeting, first).expect(200);

    const reloaded = await reload(meeting._id);
    // ~50s total, not ~20s — the point of accumulating rather than assigning.
    expect(reloaded.agendaItems.id(first._id).actualDuration).toBeGreaterThan(
      45_000,
    );
  });

  it("still rejects stopping an item that is not running", async () => {
    const meeting = await seedMeeting();

    const res = await stop(meeting, meeting.agendaItems[0]).expect(400);
    expect(res.body.message).toMatch(/not active/i);
  });

  it("marks the agenda completed once the last item finishes", async () => {
    const meeting = await seedMeeting();

    for (const item of meeting.agendaItems) {
      await start(meeting, item).expect(200);
      await stop(meeting, item).expect(200);
    }

    const reloaded = await reload(meeting._id);
    expect(reloaded.agendaProgress).toBe("completed");
  });

  it("never produces NaN for actualDuration", async () => {
    // `item.actualDuration += elapsed` on an undefined total yields NaN, which
    // Mongoose would then have rejected — except the field did not exist, so
    // this failure mode was invisible.
    const meeting = await seedMeeting();
    const [first] = meeting.agendaItems;

    await start(meeting, first).expect(200);
    await stop(meeting, first).expect(200);

    const reloaded = await reload(meeting._id);
    expect(
      Number.isNaN(reloaded.agendaItems.id(first._id).actualDuration),
    ).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("PUT .../skip", () => {
  it("persists skipped status", async () => {
    const meeting = await seedMeeting();

    await skip(meeting, meeting.agendaItems[1]).expect(200);

    const reloaded = await reload(meeting._id);
    expect(reloaded.agendaItems[1].status).toBe("skipped");
  });

  it("keeps the time a skipped item had already used", async () => {
    const meeting = await seedMeeting();
    const [first] = meeting.agendaItems;

    await start(meeting, first).expect(200);
    await Meeting.updateOne(
      { _id: meeting._id, "agendaItems._id": first._id },
      { $set: { "agendaItems.$.startedAt": new Date(Date.now() - 45_000) } },
    );
    await skip(meeting, first).expect(200);

    const reloaded = await reload(meeting._id);
    const item = reloaded.agendaItems.id(first._id);

    expect(item.status).toBe("skipped");
    expect(item.actualDuration).toBeGreaterThanOrEqual(44_000);
  });

  it("completes the agenda when the last remaining item is skipped", async () => {
    const meeting = await seedMeeting();

    for (const item of meeting.agendaItems) {
      await skip(meeting, item).expect(200);
    }

    const reloaded = await reload(meeting._id);
    expect(reloaded.agendaProgress).toBe("completed");
  });

  it("reopens the agenda if a skipped item is started again", async () => {
    const meeting = await seedMeeting();

    for (const item of meeting.agendaItems) {
      await skip(meeting, item).expect(200);
    }
    expect((await reload(meeting._id)).agendaProgress).toBe("completed");

    await start(meeting, meeting.agendaItems[0]).expect(200);
    expect((await reload(meeting._id)).agendaProgress).toBe("in_progress");
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("GET .../pacing", () => {
  const pacing = (meeting) =>
    request(app).get(`/api/meetings/timer/${meeting._id}/pacing`);

  it("reports real figures rather than structural zeros", async () => {
    const meeting = await seedMeeting();
    const [first, second] = meeting.agendaItems;

    await start(meeting, first);
    await Meeting.updateOne(
      { _id: meeting._id, "agendaItems._id": first._id },
      {
        $set: { "agendaItems.$.startedAt": new Date(Date.now() - 7 * 60_000) },
      },
    );
    await stop(meeting, first).expect(200);
    await skip(meeting, second).expect(200);

    const res = await pacing(meeting).expect(200);

    expect(res.body.reportData[0].actualDuration).toBe(7); // minutes
    expect(res.body.reportData[0].status).toBe("completed");
    expect(res.body.summaryStats.itemsSkipped).toBe(1);
    // Planned 5, actual 7 → over time. Against `main` this was always 0,
    // because `undefined > undefined` is false.
    expect(res.body.summaryStats.itemsOverTime).toBe(1);
    expect(res.body.agendaProgress).toBe("in_progress");
  });

  it("includes the time on the clock for a running item", async () => {
    const meeting = await seedMeeting();
    const [first] = meeting.agendaItems;

    await start(meeting, first).expect(200);
    await Meeting.updateOne(
      { _id: meeting._id, "agendaItems._id": first._id },
      {
        $set: { "agendaItems.$.startedAt": new Date(Date.now() - 3 * 60_000) },
      },
    );

    const res = await pacing(meeting).expect(200);
    // `actualDuration` is only banked on stop/skip/switch, so without the live
    // adjustment the currently-running row — the one anyone watching a live
    // meeting is looking at — reads 0.
    expect(res.body.reportData[0].actualDurationMs).toBeGreaterThanOrEqual(
      179_000,
    );
  });

  it("does not count an item with no planned duration as over time", async () => {
    const meeting = await Meeting.create({
      uploadedBy: organizer._id,
      organization: ORG_A,
      title: "Unplanned",
      date: new Date(),
      agendaItems: [{ text: "Open floor" }], // no `duration`
    });
    const [item] = meeting.agendaItems;

    await start(meeting, item);
    await Meeting.updateOne(
      { _id: meeting._id, "agendaItems._id": item._id },
      { $set: { "agendaItems.$.startedAt": new Date(Date.now() - 60_000) } },
    );
    await stop(meeting, item).expect(200);

    const res = await pacing(meeting).expect(200);
    expect(res.body.summaryStats.itemsOverTime).toBe(0);
  });

  it("counts an overrun of under thirty seconds", async () => {
    const meeting = await Meeting.create({
      uploadedBy: organizer._id,
      organization: ORG_A,
      title: "Tight",
      date: new Date(),
      agendaItems: [{ text: "Standup", duration: 5 }],
    });
    const [item] = meeting.agendaItems;

    await start(meeting, item);
    await Meeting.updateOne(
      { _id: meeting._id, "agendaItems._id": item._id },
      {
        $set: {
          "agendaItems.$.startedAt": new Date(
            Date.now() - (5 * 60_000 + 10_000),
          ),
        },
      },
    );
    await stop(meeting, item).expect(200);

    const res = await pacing(meeting).expect(200);
    // Rounds to 5 minutes, so a minute-granularity comparison would miss it.
    expect(res.body.reportData[0].actualDuration).toBe(5);
    expect(res.body.summaryStats.itemsOverTime).toBe(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe("authorization", () => {
  it("refuses a privileged caller from another organization", async () => {
    const meeting = await seedMeeting();
    currentUser = adminInOrgB;

    // Against `main`: 200. `hasPermission` accepted any admin or owner without
    // reference to the meeting's organization, and the route had no guard.
    await start(meeting, meeting.agendaItems[0]).expect(403);
    await stop(meeting, meeting.agendaItems[0]).expect(403);
    await skip(meeting, meeting.agendaItems[0]).expect(403);

    const reloaded = await reload(meeting._id);
    expect(reloaded.agendaItems[0].status).toBe("pending");
    expect(reloaded.agendaProgress).toBe("not_started");
  });

  it("allows an admin of the meeting's own organization", async () => {
    const meeting = await seedMeeting();
    currentUser = adminInOrgA;

    await start(meeting, meeting.agendaItems[0]).expect(200);
    expect((await reload(meeting._id)).agendaItems[0].status).toBe("active");
  });

  it("refuses a member who may view but not edit", async () => {
    const meeting = await seedMeeting();
    currentUser = viewerInOrgA;

    await start(meeting, meeting.agendaItems[0]).expect(403);
    // ...but the read-only pacing report is still available to them.
    await request(app)
      .get(`/api/meetings/timer/${meeting._id}/pacing`)
      .expect(200);
  });

  it("refuses an unauthenticated caller", async () => {
    const meeting = await seedMeeting();
    currentUser = null;

    await start(meeting, meeting.agendaItems[0]).expect(401);
  });

  it("rejects a malformed meeting id with 400, not 500", async () => {
    await request(app)
      .put(
        `/api/meetings/timer/not-an-objectid/agenda/${new mongoose.Types.ObjectId()}/start`,
      )
      .expect(400);
  });
});
