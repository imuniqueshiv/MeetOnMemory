import mongoose from "mongoose";
import RecurringActionItem from "../models/recurringActionItemModel.js";
import ActionItem from "../models/actionItemModel.js";
import Meeting from "../models/meetingModel.js";
import {
  generateInstances,
  handleActionItemStatusChange,
} from "../services/recurringActionItemService.js";

describe("Recurring Action Item Service", () => {
  beforeAll(async () => {
    // Note: Assuming a test database connection is handled by the test runner (e.g. setupFiles)
  });

  afterEach(async () => {
    await RecurringActionItem.deleteMany({});
    await ActionItem.deleteMany({});
    await Meeting.deleteMany({});
  });

  afterAll(async () => {
    // Close connection if necessary
  });

  it("should generate action items for upcoming meetings in series", async () => {
    const seriesId = new mongoose.Types.ObjectId();
    const orgId = new mongoose.Types.ObjectId();

    // Create a meeting for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const meeting = await Meeting.create({
      title: "Weekly Sync",
      date: tomorrow,
      series: seriesId,
      organization: orgId,
      uploadedBy: new mongoose.Types.ObjectId(), // mock user id
    });

    const recurringItem = await RecurringActionItem.create({
      text: "Review security patches",
      description: "Weekly review",
      meetingSeriesId: seriesId,
      organization: orgId,
      recurrencePattern: "daily", // Daily so it will definitely match tomorrow
      isActive: true,
    });

    const result = await generateInstances(recurringItem._id, 7);

    expect(result.count).toBe(1);

    const actionItems = await ActionItem.find({
      recurringActionItemId: recurringItem._id,
    });
    expect(actionItems).toHaveLength(1);
    expect(actionItems[0].sourceMeetingId.toString()).toBe(
      meeting._id.toString(),
    );
    expect(actionItems[0].text).toBe("Review security patches");
  });

  it("should handle status changes and update streaks", async () => {
    const recurringItem = await RecurringActionItem.create({
      text: "Update metrics",
      meetingSeriesId: new mongoose.Types.ObjectId(),
      recurrencePattern: "weekly",
      isActive: true,
    });

    const actionItem = await ActionItem.create({
      text: "Update metrics",
      sourceMeetingId: new mongoose.Types.ObjectId(),
      recurringActionItemId: recurringItem._id,
      status: "open",
    });

    // Mark as completed
    actionItem.status = "completed";
    await actionItem.save();

    await handleActionItemStatusChange(actionItem._id, "completed");

    const updatedItem = await RecurringActionItem.findById(recurringItem._id);
    expect(updatedItem.currentStreak).toBe(1);
    expect(updatedItem.totalCompleted).toBe(1);
  });
});
