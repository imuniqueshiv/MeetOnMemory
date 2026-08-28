import RecurringActionItem from "../models/recurringActionItemModel.js";
import ActionItem from "../models/actionItemModel.js";
import Meeting from "../models/meetingModel.js";
import { generateOccurrenceDates } from "../utils/recurrence.js";

// Generates instances for a specific recurring action item.
export const generateInstances = async (recurringItemId, daysAhead = 7) => {
  const recurringItem = await RecurringActionItem.findById(recurringItemId);
  if (!recurringItem || !recurringItem.isActive) return { count: 0 };

  const now = new Date();
  now.setHours(0, 0, 0, 0); // Start of today
  const targetEndDate = new Date(now);
  targetEndDate.setDate(now.getDate() + daysAhead);
  targetEndDate.setHours(23, 59, 59, 999);

  // Use recurrence.js to find the expected dates
  // Wait, recurrence.js needs startDate. We can use `now` as the startDate.
  const recurrenceResult = generateOccurrenceDates({
    recurrencePattern: recurringItem.recurrencePattern,
    startDate: now,
    endDate: targetEndDate,
    dayOfWeek: recurringItem.dayOfWeek,
    dayOfMonth: recurringItem.dayOfMonth,
    time: recurringItem.time,
  });

  const generatedDates = recurrenceResult.dates;
  if (generatedDates.length === 0) return { count: 0 };

  // Find all meetings in the series within the window
  const meetings = await Meeting.find({
    series: recurringItem.meetingSeriesId,
    date: { $gte: now, $lte: targetEndDate },
    deletedAt: null,
  });

  let createdCount = 0;

  for (const meeting of meetings) {
    // Check if an action item for this meeting and recurring item already exists
    const existing = await ActionItem.findOne({
      recurringActionItemId: recurringItem._id,
      sourceMeetingId: meeting._id,
    });

    if (!existing) {
      await ActionItem.create({
        text: recurringItem.text,
        description: recurringItem.description,
        owner: recurringItem.owner,
        assignee: recurringItem.assignee,
        sourceMeetingId: meeting._id,
        organization: recurringItem.organization,
        recurringActionItemId: recurringItem._id,
        status: "open",
        dueDate: meeting.date, // Default to meeting date
      });
      createdCount++;
    }
  }

  // Update nextRunDate to avoid running too frequently if we wanted to
  recurringItem.nextRunDate = new Date();
  await recurringItem.save();

  return { count: createdCount };
};

// Process all active recurring action items
export const processAllRecurringActionItems = async (daysAhead = 7) => {
  const activeItems = await RecurringActionItem.find({ isActive: true });
  let totalCreated = 0;

  for (const item of activeItems) {
    const result = await generateInstances(item._id, daysAhead);
    totalCreated += result.count;
  }

  return { totalProcessed: activeItems.length, totalCreated };
};

// Handle status change of a child action item to update streaks
export const handleActionItemStatusChange = async (actionItemId, newStatus) => {
  const actionItem = await ActionItem.findById(actionItemId);
  if (!actionItem || !actionItem.recurringActionItemId) return;

  const recurringItem = await RecurringActionItem.findById(
    actionItem.recurringActionItemId,
  );
  if (!recurringItem) return;

  if (newStatus === "completed" || newStatus === "resolved") {
    recurringItem.currentStreak += 1;
    recurringItem.totalCompleted += 1;
    if (recurringItem.currentStreak > recurringItem.highestStreak) {
      recurringItem.highestStreak = recurringItem.currentStreak;
    }
  } else if (newStatus === "cancelled" || newStatus === "overdue") {
    // Reset streak on miss
    recurringItem.currentStreak = 0;
    recurringItem.totalMissed += 1;
  }

  await recurringItem.save();
};

export default {
  generateInstances,
  processAllRecurringActionItems,
  handleActionItemStatusChange,
};
