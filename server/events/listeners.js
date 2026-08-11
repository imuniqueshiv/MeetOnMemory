import eventBus from "../services/eventBus.js";
import { createNotifications } from "../services/notificationService.js";
import { awardEngagementPoints } from "../services/OrganizationService.js";

// ─────────────────────────────────────────────────────────────────────────────
// Issue #977 — this entire module used to be dead code.
//
// `initListeners` was exported and never called:
//
//     $ grep -rn "initListeners" server --include="*.js"
//     server/events/listeners.js:5:export const initListeners = (io) => {
//     server/events/listeners.js:7:    console.warn("⚠️ initListeners: ...
//
// Only the declaration. So every in-app notification and every engagement point
// in the product silently did nothing: the events were emitted, the socket rooms
// were joined, and `Navbar.jsx` was listening for `notification:new` — but
// nothing on the server was subscribed.
//
// It went unnoticed because the four *other* event consumers (slackService,
// cacheInvalidationService, conflictScanTrigger, webhookDispatcherService)
// register at module top level and are side-effect-imported in server.js, so
// Slack, webhooks, cache invalidation and conflict scans all worked — making the
// event bus look healthy. This module is the one that wrapped its `eventBus.on`
// calls in an exported init function that was never wired into the bootstrap.
//
// Beyond calling it, three things had to change before turning it on was safe:
//
//   1. Registration must be idempotent. `EventEmitter` has no dedup, so a
//      double call (tests, hot reload, a future second bootstrap path) would
//      send every user two of every notification.
//   2. Handlers must be rejection-safe. These are `async` functions attached to
//      a plain EventEmitter — a rejection inside one becomes an unhandled
//      promise rejection, which on Node >= 15 can terminate the process.
//   3. Fan-out must not be a sequential N+1. See notificationService.js.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guards against double registration.
 *
 * Module-scoped rather than a property on `io`, because the failure we care
 * about is "this module registered its handlers twice", regardless of which
 * `io` instance was passed.
 */
let registered = false;

/** Exposed for tests, which need a clean slate per case. */
export const _resetListenerRegistration = () => {
  registered = false;
};

/**
 * Wraps an async event handler so a rejection is logged with event context
 * instead of escaping as an unhandled rejection.
 *
 * @param {string} eventName
 * @param {Function} handler
 */
const safeHandler =
  (eventName, handler) =>
  async (...args) => {
    try {
      await handler(...args);
    } catch (error) {
      console.error(
        `❌ Event handler for "${eventName}" failed:`,
        error?.message || error,
      );
    }
  };

/**
 * Emits a batch of notifications to their recipients' personal socket rooms.
 *
 * Users join a room named after their own id on connect
 * (`socket/meetingSocket.js`), which is what makes `io.to(userId)` work.
 *
 * @param {object} io
 * @param {object[]} notifications formatted notifications, each with a `user`
 */
const emitToRooms = (io, notifications) => {
  for (const { room, notification } of notifications) {
    io.to(room).emit("notification:new", notification);
  }
};

/**
 * Creates notifications for a set of recipients and pushes them over Socket.IO.
 *
 * `createNotifications` returns only the recipients that were actually
 * delivered to (suppressed ones are filtered out), so the socket emit
 * automatically respects preferences without a second check.
 *
 * @param {object} io
 * @param {Array<string|object>} recipients
 * @param {object} payload
 */
const notify = async (io, recipients, payload) => {
  const created = await createNotifications(recipients, payload);
  if (created.length === 0) return [];

  emitToRooms(
    io,
    created.map((notification) => ({
      // `insertMany` preserves input order, but the delivered set is a filtered
      // subset — so read the recipient back off the document rather than
      // indexing into the original array.
      room: String(notification.user ?? ""),
      notification,
    })),
  );

  return created;
};

/**
 * Registers every notification and gamification listener.
 *
 * @param {object} io Socket.IO server instance
 * @returns {boolean} true if listeners were registered by this call
 */
export const initListeners = (io) => {
  if (!io) {
    console.warn("⚠️ initListeners: Socket.IO instance is not provided.");
    return false;
  }

  if (registered) {
    console.warn(
      "⚠️ initListeners: already registered — skipping to avoid duplicate notifications.",
    );
    return false;
  }
  registered = true;

  const on = (eventName, handler) =>
    eventBus.on(eventName, safeHandler(eventName, handler));

  // ─────────────────────────────────────────────────────────────
  // MEETINGS
  // ─────────────────────────────────────────────────────────────

  on("meeting.created", async ({ meeting, membersToNotify = [] }) => {
    if (!meeting) return;

    // One preference query and one insert for the whole organization, instead
    // of two queries per member awaited in sequence.
    const recipients = membersToNotify
      .map((membership) => membership?.user?._id ?? membership?.user)
      .filter(Boolean);

    await notify(io, recipients, {
      title: "New Meeting Scheduled",
      description: `A new meeting "${meeting.title}" has been scheduled.`,
      category: "meetings",
      actionUrl: `/meeting/${meeting._id}`,
      actionLabel: "View Details",
      metadata: { meetingId: meeting._id },
    });
  });

  // ─────────────────────────────────────────────────────────────
  // MoM / AI PROCESSING
  // ─────────────────────────────────────────────────────────────

  on("mom.generated", async (meeting) => {
    if (!meeting) return;

    const userId = meeting.uploadedBy || meeting.owner;
    if (!userId) return;

    if (meeting.organization) {
      await awardEngagementPoints(userId, meeting.organization, 50);
    }

    await notify(io, [userId], {
      title: "Minutes of Meeting Generated",
      description: `MoM for "${meeting.title}" is ready.`,
      category: "ai_processing",
      actionUrl: `/meeting/${meeting._id}`,
      actionLabel: "View MoM",
      metadata: { meetingId: meeting._id },
    });

    // Distinct from the notification: the meeting-details UI listens for this
    // to swap a "processing" placeholder for the finished MoM. It is emitted
    // unconditionally, because it is a UI state update rather than a
    // notification, and notification preferences must not suppress it.
    io.to(String(userId)).emit("mom-generation-complete", {
      meetingId: meeting._id,
      title: meeting.title,
      summary: meeting.summary,
      mom: meeting.structuredMoM,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DATA EXPORT
  // ─────────────────────────────────────────────────────────────

  on("export.ready", async ({ userId, downloadUrl }) => {
    if (!userId) return;

    await notify(io, [userId], {
      title: "Data Export Ready",
      description: "Your data export has been completed and emailed to you.",
      // Category "system" is intentionally not suppressible — the user
      // explicitly requested this export and it expires.
      category: "system",
      actionUrl: downloadUrl,
      actionLabel: "Download",
    });
  });

  // ─────────────────────────────────────────────────────────────
  // ORGANIZATIONS
  // ─────────────────────────────────────────────────────────────

  on(
    "organization.joined",
    async ({ userId, _organizationId, organizationName, adminId }) => {
      if (!adminId) return;
      // Don't notify an admin that they themselves joined.
      if (userId && String(adminId) === String(userId)) return;

      await notify(io, [adminId], {
        title: "New Member Joined",
        description: `A new user has joined your organization: ${organizationName}.`,
        category: "organizations",
        actionUrl: "/team-members",
        actionLabel: "View Team",
      });
    },
  );

  on(
    "live_meeting.notified",
    async ({ _uploaderId, roomId, participants = [], _orgId }) => {
      const recipients = participants
        .map((user) => user?._id ?? user)
        .filter(Boolean);

      await notify(io, recipients, {
        title: "Live Meeting Started",
        description: "You have been invited to join a live meeting.",
        category: "meetings",
        actionUrl: `/meeting-room/${roomId}`,
        actionLabel: "Join Now",
        metadata: { roomId },
      });
    },
  );

  // ─────────────────────────────────────────────────────────────
  // GAMIFICATION
  //
  // `awardEngagementPoints` is called from these three handlers and nowhere
  // else in the codebase, so while this module was unwired no user could ever
  // earn a point and the Top Contributors leaderboard was permanently empty.
  // ─────────────────────────────────────────────────────────────

  on("policy.created", async (policy) => {
    const userId = policy?.uploadedBy;
    if (userId && policy.organization) {
      await awardEngagementPoints(userId, policy.organization, 20);
    }
  });

  on("actionItem.completed", async ({ userId, organizationId }) => {
    if (userId && organizationId) {
      await awardEngagementPoints(userId, organizationId, 10);
    }
  });

  console.log("✅ Event listeners initialized");
  return true;
};

export default initListeners;
