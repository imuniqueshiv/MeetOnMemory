import Meeting from "../models/meetingModel.js";

// Utility to check permissions (Organizer or Admin)
const hasPermission = (meeting, userId) => {
  return meeting.uploadedBy.toString() === userId;
  // TODO: Add logic to check for Org Admin if required by the org structure.
};

export const startAgendaItem = async (req, res) => {
  try {
    const { meetingId, itemId } = req.params;
    const userId = req.user.id;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    if (!hasPermission(meeting, userId)) {
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

    // Set other items to pending if they were active
    meeting.agendaItems.forEach((ai) => {
      if (ai.status === "active") {
        ai.status = "pending";
        // Optionally calculate duration for the interrupted item, but let's keep it simple for now
      }
    });

    item.status = "active";
    item.startedAt = new Date();

    // Update meeting progress state
    if (meeting.agendaProgress === "not_started") {
      meeting.agendaProgress = "in_progress";
    }

    await meeting.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`meeting_${meetingId}`).emit("agenda_timer_updated", {
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
    const userId = req.user.id;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    if (!hasPermission(meeting, userId)) {
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

    if (item.status !== "active") {
      return res
        .status(400)
        .json({ success: false, message: "Agenda item is not active" });
    }

    item.status = "completed";
    item.completedAt = new Date();

    if (item.startedAt) {
      const elapsed = item.completedAt.getTime() - item.startedAt.getTime();
      item.actualDuration += elapsed;
    }

    // Check if all items are completed/skipped
    const allDone = meeting.agendaItems.every(
      (ai) => ai.status === "completed" || ai.status === "skipped",
    );
    if (allDone) {
      meeting.agendaProgress = "completed";
    }

    await meeting.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`meeting_${meetingId}`).emit("agenda_timer_updated", {
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
    const userId = req.user.id;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    if (!hasPermission(meeting, userId)) {
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

    if (item.status === "active") {
      item.completedAt = new Date();
      if (item.startedAt) {
        const elapsed = item.completedAt.getTime() - item.startedAt.getTime();
        item.actualDuration += elapsed;
      }
    }

    item.status = "skipped";

    const allDone = meeting.agendaItems.every(
      (ai) => ai.status === "completed" || ai.status === "skipped",
    );
    if (allDone) {
      meeting.agendaProgress = "completed";
    }

    await meeting.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`meeting_${meetingId}`).emit("agenda_timer_updated", {
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

    const meeting = await Meeting.findById(meetingId).select(
      "agendaItems agendaProgress",
    );
    if (!meeting) {
      return res
        .status(404)
        .json({ success: false, message: "Meeting not found" });
    }

    const reportData = meeting.agendaItems.map((item) => ({
      id: item._id,
      text: item.text,
      plannedDuration: item.duration || 0, // in minutes
      actualDuration: item.actualDuration
        ? Math.round(item.actualDuration / 60000)
        : 0, // convert ms to minutes
      status: item.status,
    }));

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
      itemsOverTime: reportData.filter(
        (i) => i.actualDuration > i.plannedDuration,
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
