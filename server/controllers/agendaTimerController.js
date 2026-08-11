import Meeting from "../models/meetingModel.js";

/**
 * May this user drive the agenda timer for this meeting?
 *
 * Two things were wrong here (Issue #1159):
 *
 *   - `isOrgAdmin` was `userRole === "admin" || "owner"` with no reference to
 *     the meeting at all. `userRole` is the caller's role in *their own*
 *     organization, and `meeting` came from a bare `Meeting.findById` with no
 *     org filter, so anyone who was an admin anywhere satisfied it for a
 *     meeting in *any* organization. The route-level `requireOrgAccess` added
 *     alongside this change is the primary fix; scoping the check here means
 *     the handler is not relying on the router to be correct.
 *   - `userId` came from `req.user.id`, the Mongoose virtual. It happens to
 *     work, but it is the only place in the file reading it that way, so it
 *     now takes `req.user` and normalizes internally.
 */
const canManageTimers = (meeting, user) => {
  if (!meeting || !user) return false;

  const userId = (user._id ?? user.id)?.toString();
  if (!userId) return false;

  const isUploader = meeting.uploadedBy?.toString() === userId;

  const sameOrg = Boolean(
    meeting.organization &&
    user.organization &&
    meeting.organization.toString() === user.organization.toString(),
  );
  const isOrgAdmin =
    sameOrg && (user.role === "admin" || user.role === "owner");

  return isUploader || isOrgAdmin;
};

/**
 * Folds a running item's elapsed time into its accumulated total and clears
 * the start marker.
 *
 * `startAgendaItem` used to demote a running item to `pending` with no time
 * accounting — the comment said so ("let's keep it simple for now"). Because a
 * later restart overwrites `startedAt`, the first interval was unrecoverable.
 * That was latent while nothing persisted; it becomes real data loss the moment
 * the schema is fixed, so it is fixed here in the same change.
 *
 * Guards against a negative contribution: a `startedAt` in the future (clock
 * skew across instances, or a hand-edited document) must not subtract from an
 * accumulated total.
 */
const accumulateElapsed = (item, now) => {
  if (!item.startedAt) return 0;

  const elapsed = Math.max(0, now.getTime() - item.startedAt.getTime());
  item.actualDuration = (item.actualDuration || 0) + elapsed;
  item.startedAt = null;

  return elapsed;
};

/** True once every item has reached a terminal state. */
const allItemsFinished = (items) =>
  items.length > 0 &&
  items.every((ai) => ai.status === "completed" || ai.status === "skipped");

export const startAgendaItem = async (req, res) => {
  try {
    const { meetingId, itemId } = req.params;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    if (!canManageTimers(meeting, req.user)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to manage timers" });
    }

    const item = meeting.agendaItems.id(itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Agenda item not found" });
    }

    const now = new Date();

    // Set other items to pending if they were active — banking their elapsed
    // time on the way, rather than discarding it.
    meeting.agendaItems.forEach((ai) => {
      if (ai._id.toString() !== itemId && ai.status === "active") {
        accumulateElapsed(ai, now);
        ai.status = "pending";
      }
    });

    // Restarting the item that is already running would otherwise reset its
    // clock and silently drop the interval so far.
    if (item.status === "active") {
      accumulateElapsed(item, now);
    }

    item.status = "active";
    item.startedAt = now;
    item.completedAt = null;

    // Update meeting progress state. Resuming a skipped or completed item
    // reopens the agenda, so `completed` is not a terminal state for the
    // meeting either.
    if (meeting.agendaProgress !== "in_progress") {
      meeting.agendaProgress = "in_progress";
    }

    await meeting.save();

    const io = req.app.get("io");
    if (io) {
      io.to(meetingId.toString()).emit("agenda_timer_updated", {
        meetingId,
        item,
        action: "start",
      });
    }

    res.status(200).json({ success: true, item });
  } catch (error) {
    console.error("Error in startAgendaItem:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const stopAgendaItem = async (req, res) => {
  try {
    const { meetingId, itemId } = req.params;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    if (!canManageTimers(meeting, req.user)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to manage timers" });
    }

    const item = meeting.agendaItems.id(itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Agenda item not found" });
    }

    // This guard is why `stop` returned 400 on every request: `status` was
    // never persisted, so the reloaded item always had `undefined` here. The
    // guard itself is correct and stays — it just has real state to read now.
    if (item.status !== "active") {
      return res
        .status(400)
        .json({ success: false, message: "Agenda item is not active" });
    }

    const now = new Date();
    // `accumulateElapsed` adds to `actualDuration` and clears `startedAt`. The
    // old `item.actualDuration += elapsed` would have produced `NaN` on any
    // item whose total had not been initialized — which, with the field absent
    // from the schema, was all of them.
    accumulateElapsed(item, now);
    item.status = "completed";
    item.completedAt = now;

    // Check if all items are completed/skipped
    if (allItemsFinished(meeting.agendaItems)) {
      meeting.agendaProgress = "completed";
    }

    await meeting.save();

    const io = req.app.get("io");
    if (io) {
      io.to(meetingId.toString()).emit("agenda_timer_updated", {
        meetingId,
        item,
        action: "stop",
      });
    }

    res.status(200).json({ success: true, item });
  } catch (error) {
    console.error("Error in stopAgendaItem:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const skipAgendaItem = async (req, res) => {
  try {
    const { meetingId, itemId } = req.params;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    if (!canManageTimers(meeting, req.user)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to manage timers" });
    }

    const item = meeting.agendaItems.id(itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Agenda item not found" });
    }

    // Skipping a running item keeps whatever time it did use — the discussion
    // happened, it just was not finished.
    if (item.status === "active") {
      const now = new Date();
      accumulateElapsed(item, now);
      item.completedAt = now;
    }

    item.status = "skipped";

    if (allItemsFinished(meeting.agendaItems)) {
      meeting.agendaProgress = "completed";
    }

    await meeting.save();

    const io = req.app.get("io");
    if (io) {
      io.to(meetingId.toString()).emit("agenda_timer_updated", {
        meetingId,
        item,
        action: "skip",
      });
    }

    res.status(200).json({ success: true, item });
  } catch (error) {
    console.error("Error in skipAgendaItem:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getAgendaPacingReport = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting =
      req.doc ||
      (await Meeting.findById(meetingId).select("agendaItems agendaProgress"));
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    const now = Date.now();

    const reportData = meeting.agendaItems.map((item) => {
      // An item that is running right now has time on the clock that is not
      // yet in `actualDuration` — that is only banked on stop/skip/switch.
      // Without this the currently-active item reports 0, which is the one row
      // anybody watching a live meeting is looking at.
      const liveElapsed =
        item.status === "active" && item.startedAt
          ? Math.max(0, now - new Date(item.startedAt).getTime())
          : 0;

      const actualMs = (item.actualDuration || 0) + liveElapsed;

      return {
        id: item._id,
        text: item.text,
        plannedDuration: item.duration || 0, // in minutes
        actualDuration: Math.round(actualMs / 60000), // convert ms to minutes
        // Rounding to whole minutes loses the difference between a 5-minute
        // item that ran 5m00s and one that ran 5m50s, so the unrounded value
        // is reported alongside it. `AgendaPacingReport.jsx` keeps charting
        // `actualDuration`; this is for anything that needs the real figure.
        actualDurationMs: actualMs,
        status: item.status,
      };
    });

    const summaryStats = {
      totalPlanned: reportData.reduce(
        (acc, curr) => acc + curr.plannedDuration,
        0,
      ),
      totalActual: reportData.reduce(
        (acc, curr) => acc + curr.actualDuration,
        0,
      ),
      itemsSkipped: reportData.filter((i) => i.status === "skipped").length,
      // Compared in milliseconds against the planned minutes, so an item that
      // overruns by less than 30 seconds is still counted — rounding both
      // sides to minutes first hid exactly the overruns worth reporting. An
      // item with no planned duration cannot be over its plan.
      itemsOverTime: reportData.filter(
        (i) =>
          i.plannedDuration > 0 &&
          i.actualDurationMs > i.plannedDuration * 60000,
      ).length,
    };

    res.status(200).json({
      success: true,
      reportData,
      summaryStats,
      agendaProgress: meeting.agendaProgress,
    });
  } catch (error) {
    console.error("Error in getAgendaPacingReport:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
