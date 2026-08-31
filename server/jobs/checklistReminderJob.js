import cron from "node-cron";
import MeetingChecklist from "../models/meetingChecklistModel.js";
import Meeting from "../models/meetingModel.js";
import eventBus from "../services/eventBus.js";

export const processChecklistReminders = async () => {
  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowEnd = new Date(tomorrow.getTime() + 60 * 60 * 1000); // 1 hour window

    // Find meetings happening in ~24h
    const upcomingMeetings = await Meeting.find({
      date: {
        $gte: tomorrow.toISOString(),
        $lt: tomorrowEnd.toISOString(),
      },
      status: { $ne: "cancelled" },
    });

    for (const meeting of upcomingMeetings) {
      const checklist = await MeetingChecklist.findOne({
        meetingId: meeting._id,
      });
      if (!checklist || checklist.items.length === 0) continue;

      // Map completions: itemIndex -> Set of userIds who completed it
      const itemCompletions = checklist.completions.reduce((acc, comp) => {
        const idx = comp.itemIndex;
        if (!acc[idx]) acc[idx] = new Set();
        acc[idx].add(comp.userId.toString());
        return acc;
      }, {});

      for (const participant of meeting.participants) {
        const uid =
          participant.user?.toString() || participant.userId?.toString();
        if (!uid) continue;

        let hasIncompleteTask = false;

        checklist.items.forEach((item, index) => {
          const completedBySet = itemCompletions[index] || new Set();
          const isCompleted = completedBySet.has(uid);

          if (!isCompleted) {
            if (item.assignee) {
              if (item.assignee.toString() === uid) {
                hasIncompleteTask = true;
              }
            } else {
              // Unassigned task is responsibility of all participants
              hasIncompleteTask = true;
            }
          }
        });

        if (hasIncompleteTask) {
          eventBus.emit("notification:created", {
            type: "checklist_reminder",
            userId: uid,
            data: {
              meetingId: meeting._id,
              meetingTitle: meeting.title,
              message: `You have incomplete preparation tasks for the upcoming meeting: ${meeting.title}`,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error("Error in checklistReminderJob:", error);
  }
};

export const initChecklistReminderJob = () => {
  // Run every hour
  cron.schedule("0 * * * *", processChecklistReminders);
};
