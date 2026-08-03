import notificationModel from "../models/notificationModel.js";
import NotificationPreference from "../models/notificationPreferenceModel.js";

// ─────────────────────────────────────────────────────────────────────────────
// Issue #977 — notification delivery.
//
// Two problems lived here:
//
//   1. Only two of the six preference toggles were ever consulted. `system`,
//      `organizations`, `policies` and `reports` mapped to `null`, and
//      `pushTaskAssignments` / the three `email*` toggles were writable through
//      the API and rendered as working switches in the UI while being read by
//      nothing at all.
//
//   2. Fan-out was a sequential N+1. `events/listeners.js` looped over
//      recipients awaiting `createNotification` per person, and each call ran
//      its own `NotificationPreference.findOne()` *and* its own `create()`. For
//      a 500-member organization that is 1000 sequential round-trips inside an
//      un-awaited EventEmitter handler.
//
// `createNotifications` (plural) fixes the second by prefetching every relevant
// preference in one query and writing with one `insertMany`. `createNotification`
// stays as a thin wrapper so no existing caller had to change.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a notification category to the preference field that governs it.
 *
 * `null` means "always deliver" — a deliberate choice, not an oversight:
 * `system` covers account and export notifications a user cannot opt out of
 * without losing things they explicitly asked for.
 *
 * Every category in `notificationModel`'s enum must appear here. The test suite
 * asserts that, so adding a category without deciding how it's governed fails
 * loudly instead of silently defaulting to "always send".
 */
export const CATEGORY_TO_PREFERENCE = Object.freeze({
  meetings: "pushMeetingReminders",
  tasks: "pushTaskAssignments",
  ai_processing: "pushAiProcessingComplete",
  organizations: "pushOrganizationUpdates",
  policies: "pushPolicyUpdates",
  reports: "pushReportUpdates",
  system: null,
});

/**
 * Loads preferences for many users in one query and returns a lookup keyed by
 * user id.
 *
 * Users with no preference document are simply absent; callers treat that as
 * "all defaults", which matches the previous per-user behaviour (`if (!prefs)
 * return false`).
 *
 * @param {Array<string|object>} userIds
 * @returns {Promise<Map<string, object>>}
 */
const loadPreferences = async (userIds) => {
  const map = new Map();
  if (!userIds.length) return map;

  try {
    const docs = await NotificationPreference.find({
      user: { $in: userIds },
    }).lean();

    for (const doc of docs) {
      map.set(String(doc.user), doc);
    }
  } catch (error) {
    // Preferences are an optimisation over "deliver everything". Failing to
    // read them must not silently drop notifications, so fall through to an
    // empty map (= defaults = deliver).
    console.error(
      "⚠️ Failed to load notification preferences; delivering with defaults:",
      error.message,
    );
  }

  return map;
};

/**
 * Decides whether a category is suppressed for a given preference document.
 *
 * @param {object|undefined} prefs
 * @param {string} category
 * @returns {boolean}
 */
export const isSuppressed = (prefs, category) => {
  const field = CATEGORY_TO_PREFERENCE[category];
  if (!field) return false;
  if (!prefs) return false;
  // Only an explicit `false` suppresses. An undefined field (a preference
  // document written before this toggle existed) means "not configured", which
  // must fall back to the schema default rather than being read as "off".
  return prefs[field] === false;
};

/**
 * Formats a notification document for API/socket responses.
 *
 * @param {object} notification
 */
export const formatNotification = (notification) => ({
  id: notification._id,
  // Included so bulk callers can route each notification to its recipient's
  // socket room. `insertMany` preserves input order, but the delivered set is a
  // *filtered* subset (suppressed recipients are dropped), so the recipient has
  // to be read back off the document rather than inferred by index.
  user: notification.user,
  title: notification.title,
  description: notification.description,
  category: notification.category,
  isRead: notification.isRead,
  actionUrl: notification.actionUrl,
  actionLabel: notification.actionLabel,
  metadata: notification.metadata,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
});

/**
 * Creates one notification per recipient in a single round-trip pair.
 *
 * Replaces the sequential loop that ran two queries per recipient. Total cost is
 * now one `find` plus one `insertMany`, regardless of how many people are being
 * notified.
 *
 * @param {Array<string|object>} recipients user ids
 * @param {object} payload
 * @param {string} payload.title
 * @param {string} payload.description
 * @param {string} [payload.category]
 * @param {string} [payload.actionUrl]
 * @param {string} [payload.actionLabel]
 * @param {object} [payload.metadata]
 * @returns {Promise<object[]>} formatted notifications for delivered recipients
 */
export const createNotifications = async (recipients, payload) => {
  const {
    title,
    description,
    category = "system",
    actionUrl = "",
    actionLabel = "",
    metadata = {},
  } = payload ?? {};

  if (!Array.isArray(recipients) || recipients.length === 0) return [];
  if (!title || !description) {
    console.warn(
      "⚠️ createNotifications: title and description are required — skipping.",
    );
    return [];
  }

  // De-duplicate up front. A user who is both the organizer and an attendee
  // would otherwise get the same notification twice.
  const uniqueIds = [
    ...new Set(recipients.filter(Boolean).map((id) => String(id))),
  ];
  if (uniqueIds.length === 0) return [];

  try {
    const prefsByUser = await loadPreferences(uniqueIds);

    const deliverTo = uniqueIds.filter(
      (userId) => !isSuppressed(prefsByUser.get(userId), category),
    );

    const suppressedCount = uniqueIds.length - deliverTo.length;
    if (suppressedCount > 0) {
      console.log(
        `🔇 ${suppressedCount} notification(s) suppressed — category "${category}" disabled in preferences`,
      );
    }

    if (deliverTo.length === 0) return [];

    const docs = await notificationModel.insertMany(
      deliverTo.map((user) => ({
        user,
        title,
        description,
        category,
        actionUrl,
        actionLabel,
        metadata,
      })),
    );

    return docs.map(formatNotification);
  } catch (error) {
    // Notification delivery is never allowed to break the flow that triggered
    // it (meeting creation, export completion, …).
    console.error("Error creating notifications:", error);
    return [];
  }
};

/**
 * Creates a notification for a single user.
 *
 * Signature unchanged from the original positional form so every existing
 * caller keeps working.
 *
 * @param {string} userId - The ID of the user to notify
 * @param {string} title - Notification title
 * @param {string} description - Notification description
 * @param {string} category - Category (e.g. "meetings", "tasks", "system")
 * @param {string} actionUrl - URL to navigate to when clicked (optional)
 * @param {string} actionLabel - Label for the action button (optional)
 * @param {object} metadata - Additional metadata (optional)
 * @returns {Promise<object|null>} formatted notification, or null if suppressed
 */
export const createNotification = async (
  userId,
  title,
  description,
  category = "system",
  actionUrl = "",
  actionLabel = "",
  metadata = {},
) => {
  if (!userId) return null;

  const [notification] = await createNotifications([userId], {
    title,
    description,
    category,
    actionUrl,
    actionLabel,
    metadata,
  });

  return notification ?? null;
};
