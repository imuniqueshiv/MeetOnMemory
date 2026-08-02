/**
 * Issue #977 — the in-app notification and engagement-points pipeline.
 *
 * The headline regression is that `initListeners` was exported and never
 * called, so every notification and every engagement point silently did
 * nothing. These suites assert that the pipeline is wired, that wiring it twice
 * doesn't double-send, that a throwing handler can't take the process down, and
 * that fan-out is no longer an N+1.
 */

import { jest } from "@jest/globals";
import mongoose from "mongoose";

const mockAwardEngagementPoints = jest.fn(async () => {});
jest.unstable_mockModule("../services/OrganizationService.js", () => ({
  awardEngagementPoints: mockAwardEngagementPoints,
}));

const notificationModel = (await import("../models/notificationModel.js"))
  .default;
const NotificationPreference = (
  await import("../models/notificationPreferenceModel.js")
).default;
const eventBus = (await import("../services/eventBus.js")).default;
const {
  CATEGORY_TO_PREFERENCE,
  createNotification,
  createNotifications,
  isSuppressed,
} = await import("../services/notificationService.js");
const { initListeners, _resetListenerRegistration } =
  await import("../events/listeners.js");

const objectId = () => new mongoose.Types.ObjectId();

// These suites exercise real Mongo writes (bulk insert counts, TTL index,
// preference filtering) but deliberately don't import server.js — pulling in the
// whole app just to get a connection would drag the Pinecone/transformers module
// graph into this test. Connect to the in-memory server that tests/setup.js
// already started instead.
beforeAll(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  }
});

/** Minimal Socket.IO stub that records every emit and the room it targeted. */
const makeIo = () => {
  const emits = [];
  return {
    emits,
    to: (room) => ({
      emit: (event, payload) => emits.push({ room, event, payload }),
    }),
  };
};

/**
 * Waits for the EventEmitter's async handlers to settle.
 *
 * `eventBus.emit` is synchronous and returns before an async handler has done
 * its DB work, so a single microtask flush isn't enough. Poll instead of
 * sleeping a fixed amount: it keeps the fast path fast and the slow path
 * reliable.
 *
 * @param {Function} [condition] resolves as soon as this returns truthy
 */
const flush = async (condition = null, timeoutMs = 3000) => {
  const deadline = Date.now() + timeoutMs;
  do {
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (!condition) return;
    if (condition()) return;
  } while (Date.now() < deadline);
};

beforeEach(() => {
  jest.clearAllMocks();
  _resetListenerRegistration();
  eventBus.removeAllListeners();
});

afterAll(() => {
  eventBus.removeAllListeners();
});

describe("category → preference mapping", () => {
  it("covers every category the notification model allows", () => {
    // Previously `system`, `organizations`, `policies` and `reports` all mapped
    // to null, and `pushTaskAssignments` was read by nothing at all. Asserting
    // full coverage means a new category can't silently default to "always
    // send" without someone deciding that.
    const schemaCategories =
      notificationModel.schema.path("category").enumValues;

    expect(Object.keys(CATEGORY_TO_PREFERENCE).sort()).toEqual(
      [...schemaCategories].sort(),
    );
  });

  it("includes the tasks category", () => {
    expect(CATEGORY_TO_PREFERENCE.tasks).toBe("pushTaskAssignments");
  });

  it("leaves system notifications unsuppressible", () => {
    // The user explicitly asked for their export and the link expires.
    expect(CATEGORY_TO_PREFERENCE.system).toBeNull();
    expect(isSuppressed({ pushMeetingReminders: false }, "system")).toBe(false);
  });

  it("suppresses only on an explicit false", () => {
    expect(isSuppressed({ pushMeetingReminders: false }, "meetings")).toBe(
      true,
    );
    expect(isSuppressed({ pushMeetingReminders: true }, "meetings")).toBe(
      false,
    );
    // An undefined field means "written before this toggle existed", which must
    // fall back to the schema default rather than reading as "off".
    expect(isSuppressed({}, "meetings")).toBe(false);
    expect(isSuppressed(undefined, "meetings")).toBe(false);
  });
});

describe("createNotifications — bulk fan-out", () => {
  it("creates one notification per recipient", async () => {
    const users = [objectId(), objectId(), objectId()];

    const created = await createNotifications(users, {
      title: "New Meeting Scheduled",
      description: "A new meeting has been scheduled.",
      category: "meetings",
    });

    expect(created).toHaveLength(3);
    expect(await notificationModel.countDocuments()).toBe(3);
  });

  it("uses one preference query and one insert regardless of recipient count", async () => {
    const findSpy = jest.spyOn(NotificationPreference, "find");
    const insertSpy = jest.spyOn(notificationModel, "insertMany");

    try {
      const users = Array.from({ length: 50 }, () => objectId());

      await createNotifications(users, {
        title: "T",
        description: "D",
        category: "meetings",
      });

      // The old path ran a findOne + create per recipient, awaited in sequence:
      // 100 sequential round-trips for these 50 users.
      expect(findSpy).toHaveBeenCalledTimes(1);
      expect(insertSpy).toHaveBeenCalledTimes(1);
      expect(insertSpy.mock.calls[0][0]).toHaveLength(50);
    } finally {
      findSpy.mockRestore();
      insertSpy.mockRestore();
    }
  });

  it("de-duplicates repeated recipients", async () => {
    const user = objectId();

    // A user who is both organizer and attendee must not be notified twice.
    const created = await createNotifications([user, user, String(user)], {
      title: "T",
      description: "D",
    });

    expect(created).toHaveLength(1);
  });

  it("filters out recipients who disabled the category", async () => {
    const optedIn = objectId();
    const optedOut = objectId();

    await NotificationPreference.create({
      user: optedOut,
      pushMeetingReminders: false,
    });

    const created = await createNotifications([optedIn, optedOut], {
      title: "T",
      description: "D",
      category: "meetings",
    });

    expect(created).toHaveLength(1);
    expect(String(created[0].user)).toBe(String(optedIn));
  });

  it("honours the tasks toggle independently of the meetings toggle", async () => {
    const user = objectId();
    await NotificationPreference.create({
      user,
      pushTaskAssignments: false,
      pushMeetingReminders: true,
    });

    // The exact bug: reminders filed under "meetings" meant the task toggle did
    // nothing and the meetings toggle killed task reminders.
    expect(
      await createNotifications([user], {
        title: "T",
        description: "D",
        category: "tasks",
      }),
    ).toHaveLength(0);

    expect(
      await createNotifications([user], {
        title: "T",
        description: "D",
        category: "meetings",
      }),
    ).toHaveLength(1);
  });

  it("enforces the previously-ignored organization/policy/report toggles", async () => {
    const user = objectId();
    await NotificationPreference.create({
      user,
      pushOrganizationUpdates: false,
      pushPolicyUpdates: false,
      pushReportUpdates: false,
    });

    for (const category of ["organizations", "policies", "reports"]) {
      expect(
        await createNotifications([user], {
          title: "T",
          description: "D",
          category,
        }),
      ).toHaveLength(0);
    }
  });

  it("returns an empty array for an empty recipient list", async () => {
    expect(
      await createNotifications([], { title: "T", description: "D" }),
    ).toEqual([]);
    expect(
      await createNotifications(null, { title: "T", description: "D" }),
    ).toEqual([]);
  });

  it("refuses to write a notification without a title or description", async () => {
    expect(await createNotifications([objectId()], { title: "T" })).toEqual([]);
    expect(await notificationModel.countDocuments()).toBe(0);
  });

  it("delivers with defaults when the preference query fails", async () => {
    const findSpy = jest
      .spyOn(NotificationPreference, "find")
      .mockImplementation(() => {
        throw new Error("mongo down");
      });

    try {
      // Preferences are an optimisation over "deliver everything"; failing to
      // read them must not silently drop notifications.
      const created = await createNotifications([objectId()], {
        title: "T",
        description: "D",
        category: "meetings",
      });
      expect(created).toHaveLength(1);
    } finally {
      findSpy.mockRestore();
    }
  });

  it("never throws out of the caller's flow", async () => {
    const insertSpy = jest
      .spyOn(notificationModel, "insertMany")
      .mockRejectedValue(new Error("write failed"));

    try {
      // Notification delivery must not break meeting creation.
      await expect(
        createNotifications([objectId()], { title: "T", description: "D" }),
      ).resolves.toEqual([]);
    } finally {
      insertSpy.mockRestore();
    }
  });
});

describe("createNotification — single-recipient wrapper", () => {
  it("keeps its original positional signature", async () => {
    const user = objectId();

    const result = await createNotification(
      user,
      "Title",
      "Description",
      "meetings",
      "/meeting/1",
      "View",
      { meetingId: "1" },
    );

    expect(result).toMatchObject({
      title: "Title",
      description: "Description",
      category: "meetings",
      actionUrl: "/meeting/1",
      actionLabel: "View",
    });
  });

  it("returns null when suppressed", async () => {
    const user = objectId();
    await NotificationPreference.create({
      user,
      pushAiProcessingComplete: false,
    });

    await expect(
      createNotification(user, "T", "D", "ai_processing"),
    ).resolves.toBeNull();
  });

  it("returns null for a missing user id", async () => {
    await expect(createNotification(null, "T", "D")).resolves.toBeNull();
  });
});

describe("initListeners — registration", () => {
  it("registers handlers for every emitted event", () => {
    const io = makeIo();
    expect(initListeners(io)).toBe(true);

    // These are the seven events with real emitters in production code.
    for (const event of [
      "meeting.created",
      "mom.generated",
      "export.ready",
      "organization.joined",
      "live_meeting.notified",
      "policy.created",
      "actionItem.completed",
    ]) {
      expect(eventBus.listenerCount(event)).toBe(1);
    }
  });

  it("is idempotent — a second call does not double-register", () => {
    const io = makeIo();
    initListeners(io);
    expect(initListeners(io)).toBe(false);

    // EventEmitter has no dedup, so a double registration would send every user
    // two of every notification.
    expect(eventBus.listenerCount("meeting.created")).toBe(1);
  });

  it("refuses to register without a Socket.IO instance", () => {
    expect(initListeners(null)).toBe(false);
    expect(eventBus.listenerCount("meeting.created")).toBe(0);
  });
});

describe("initListeners — delivery", () => {
  it("notifies every org member when a meeting is created", async () => {
    const io = makeIo();
    initListeners(io);

    const members = [objectId(), objectId()];
    const meeting = { _id: objectId(), title: "Q3 Planning" };

    eventBus.emit("meeting.created", {
      meeting,
      membersToNotify: members.map((id) => ({ user: { _id: id } })),
    });
    await flush(() => io.emits.length >= 2);

    expect(await notificationModel.countDocuments()).toBe(2);

    // The client subscribes to this in Navbar.jsx; it could never fire before.
    const pushes = io.emits.filter((e) => e.event === "notification:new");
    expect(pushes).toHaveLength(2);
    expect(pushes.map((p) => p.room).sort()).toEqual(
      members.map(String).sort(),
    );
    expect(pushes[0].payload.title).toBe("New Meeting Scheduled");
  });

  it("does not push to a member who disabled meeting notifications", async () => {
    const io = makeIo();
    initListeners(io);

    const optedIn = objectId();
    const optedOut = objectId();
    await NotificationPreference.create({
      user: optedOut,
      pushMeetingReminders: false,
    });

    eventBus.emit("meeting.created", {
      meeting: { _id: objectId(), title: "T" },
      membersToNotify: [
        { user: { _id: optedIn } },
        { user: { _id: optedOut } },
      ],
    });
    await flush(() => io.emits.length >= 1);

    const pushes = io.emits.filter((e) => e.event === "notification:new");
    expect(pushes).toHaveLength(1);
    expect(pushes[0].room).toBe(String(optedIn));
  });

  it("notifies the owner and awards points when a MoM is generated", async () => {
    const io = makeIo();
    initListeners(io);

    const owner = objectId();
    const org = objectId();

    eventBus.emit("mom.generated", {
      _id: objectId(),
      title: "Q3 Planning",
      uploadedBy: owner,
      organization: org,
      summary: "s",
      structuredMoM: {},
    });
    await flush(() => io.emits.length >= 2);

    expect(mockAwardEngagementPoints).toHaveBeenCalledWith(owner, org, 50);
    expect(io.emits.some((e) => e.event === "notification:new")).toBe(true);
    // Distinct from the notification: this drives a UI state swap.
    expect(io.emits.some((e) => e.event === "mom-generation-complete")).toBe(
      true,
    );
  });

  it("still emits mom-generation-complete when the notification is suppressed", async () => {
    const io = makeIo();
    initListeners(io);

    const owner = objectId();
    await NotificationPreference.create({
      user: owner,
      pushAiProcessingComplete: false,
    });

    eventBus.emit("mom.generated", {
      _id: objectId(),
      title: "T",
      uploadedBy: owner,
    });
    await flush(() => io.emits.length >= 1);

    // A notification preference must not suppress a UI state update, or the
    // meeting page stays stuck on "processing" forever.
    expect(io.emits.filter((e) => e.event === "notification:new")).toHaveLength(
      0,
    );
    expect(
      io.emits.filter((e) => e.event === "mom-generation-complete"),
    ).toHaveLength(1);
  });

  it("notifies the requester when an export is ready", async () => {
    const io = makeIo();
    initListeners(io);

    const user = objectId();
    eventBus.emit("export.ready", { userId: user, downloadUrl: "/dl/1" });
    await flush(() => io.emits.length >= 1);

    const [push] = io.emits;
    expect(push.room).toBe(String(user));
    expect(push.payload.title).toBe("Data Export Ready");
    expect(push.payload.actionUrl).toBe("/dl/1");
  });

  it("notifies the admin when someone joins the organization", async () => {
    const io = makeIo();
    initListeners(io);

    const admin = objectId();
    eventBus.emit("organization.joined", {
      userId: objectId(),
      organizationName: "Acme",
      adminId: admin,
    });
    await flush(() => io.emits.length >= 1);

    expect(io.emits).toHaveLength(1);
    expect(io.emits[0].room).toBe(String(admin));
  });

  it("does not notify an admin about their own join", async () => {
    const io = makeIo();
    initListeners(io);

    const admin = objectId();
    eventBus.emit("organization.joined", {
      userId: admin,
      organizationName: "Acme",
      adminId: admin,
    });
    await flush();

    expect(io.emits).toHaveLength(0);
  });

  it("notifies every participant of a live meeting", async () => {
    const io = makeIo();
    initListeners(io);

    const participants = [objectId(), objectId(), objectId()];
    eventBus.emit("live_meeting.notified", {
      roomId: "room-1",
      participants: participants.map((id) => ({ _id: id })),
    });
    await flush(() => io.emits.length >= 3);

    expect(io.emits).toHaveLength(3);
    expect(io.emits[0].payload.actionUrl).toBe("/meeting-room/room-1");
  });

  it("awards points for policy creation and action-item completion", async () => {
    const io = makeIo();
    initListeners(io);

    const user = objectId();
    const org = objectId();

    eventBus.emit("policy.created", { uploadedBy: user, organization: org });
    eventBus.emit("actionItem.completed", {
      userId: user,
      organizationId: org,
    });
    await flush(() => mockAwardEngagementPoints.mock.calls.length >= 2);

    // `awardEngagementPoints` is called from these handlers and nowhere else in
    // the codebase, so while this module was unwired the leaderboard could
    // never be anything but zero.
    expect(mockAwardEngagementPoints).toHaveBeenCalledWith(user, org, 20);
    expect(mockAwardEngagementPoints).toHaveBeenCalledWith(user, org, 10);
  });
});

describe("initListeners — error isolation", () => {
  it("logs a handler failure instead of leaking an unhandled rejection", async () => {
    const io = makeIo();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const rejections = [];
    const capture = (reason) => rejections.push(reason);
    process.on("unhandledRejection", capture);

    try {
      mockAwardEngagementPoints.mockRejectedValueOnce(new Error("db down"));
      initListeners(io);

      eventBus.emit("policy.created", {
        uploadedBy: objectId(),
        organization: objectId(),
      });
      await flush(() => errorSpy.mock.calls.length > 0);

      // These are async handlers on a plain EventEmitter; an escaping rejection
      // can terminate the process on Node >= 15.
      expect(rejections).toHaveLength(0);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Event handler for "policy.created" failed'),
        expect.anything(),
      );
    } finally {
      process.off("unhandledRejection", capture);
      errorSpy.mockRestore();
    }
  });

  it("keeps other events working after one handler throws", async () => {
    const io = makeIo();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    try {
      mockAwardEngagementPoints.mockRejectedValueOnce(new Error("db down"));
      initListeners(io);

      eventBus.emit("policy.created", {
        uploadedBy: objectId(),
        organization: objectId(),
      });
      await flush();

      eventBus.emit("export.ready", {
        userId: objectId(),
        downloadUrl: "/dl/2",
      });
      await flush(() => io.emits.length >= 1);

      expect(io.emits).toHaveLength(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("ignores an event with a missing payload", async () => {
    const io = makeIo();
    initListeners(io);

    eventBus.emit("meeting.created", { meeting: null });
    eventBus.emit("mom.generated", null);
    eventBus.emit("export.ready", {});
    await flush();

    expect(io.emits).toHaveLength(0);
    expect(await notificationModel.countDocuments()).toBe(0);
  });
});

describe("notification retention", () => {
  it("declares a TTL index on createdAt", () => {
    // Nothing ever deleted a notification, so the collection grew without bound
    // for the lifetime of the deployment.
    const ttlIndex = notificationModel.schema
      .indexes()
      .find(([, options]) => options?.expireAfterSeconds !== undefined);

    expect(ttlIndex).toBeDefined();
    expect(ttlIndex[0]).toHaveProperty("createdAt");
    expect(ttlIndex[1].expireAfterSeconds).toBeGreaterThan(0);
  });
});
