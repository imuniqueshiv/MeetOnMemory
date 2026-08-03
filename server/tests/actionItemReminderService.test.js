import { jest } from "@jest/globals";
import mongoose from "mongoose";

jest.unstable_mockModule("../models/actionItemModel.js", () => ({
  default: {
    find: jest.fn(),
  },
}));

jest.unstable_mockModule("../models/userModel.js", () => ({
  default: {
    findOne: jest.fn(),
  },
}));

jest.unstable_mockModule("../services/notificationService.js", () => ({
  createNotification: jest.fn().mockResolvedValue({ id: "notif_1" }),
}));

const ActionItem = (await import("../models/actionItemModel.js")).default;
const { createNotification } =
  await import("../services/notificationService.js");
const { processActionItemReminders } =
  await import("../services/actionItemReminderService.js");

describe("actionItemReminderService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should send upcoming reminders for action items due within 24h", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const dueDate = new Date(Date.now() + 12 * 60 * 60 * 1000);

    const mockItem = {
      _id: new mongoose.Types.ObjectId(),
      text: "Submit financial report",
      owner: userId.toString(),
      status: "open",
      dueDate,
      remindersEnabled: true,
      reminderSent: { upcoming: false, overdue: false },
      organization: orgId,
      sourceMeetingId: { _id: "m1", title: "Q3 Planning", organizer: userId },
      save: jest.fn().mockResolvedValue(true),
    };

    const mockPopulate = jest.fn().mockResolvedValue([mockItem]);
    jest.spyOn(ActionItem, "find").mockReturnValue({ populate: mockPopulate });

    const result = await processActionItemReminders({
      organization: orgId.toString(),
    });

    expect(result.upcomingCount).toBe(1);
    expect(result.overdueCount).toBe(0);
    expect(createNotification).toHaveBeenCalledWith(
      userId.toString(),
      expect.stringContaining("Due Soon"),
      expect.stringContaining("Submit financial report"),
      // Issue #977: action-item reminders moved from "meetings" to their own
      // "tasks" category, so the pushTaskAssignments preference actually
      // governs them instead of pushMeetingReminders silently killing them.
      "tasks",
      "/tasks",
      "View Action Items",
      expect.any(Object),
    );
    expect(mockItem.reminderSent.upcoming).toBe(true);
    expect(mockItem.save).toHaveBeenCalled();
  });

  it("should send overdue reminders for past action items", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const dueDate = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const mockItem = {
      _id: new mongoose.Types.ObjectId(),
      text: "Fix login bug",
      owner: userId.toString(),
      status: "in-progress",
      dueDate,
      remindersEnabled: true,
      reminderSent: { upcoming: true, overdue: false },
      organization: orgId,
      sourceMeetingId: {
        _id: "m2",
        title: "Engineering Sync",
        organizer: userId,
      },
      save: jest.fn().mockResolvedValue(true),
    };

    const mockPopulate = jest.fn().mockResolvedValue([mockItem]);
    jest.spyOn(ActionItem, "find").mockReturnValue({ populate: mockPopulate });

    const result = await processActionItemReminders({
      organization: orgId.toString(),
    });

    expect(result.upcomingCount).toBe(0);
    expect(result.overdueCount).toBe(1);
    expect(createNotification).toHaveBeenCalledWith(
      userId.toString(),
      expect.stringContaining("Overdue"),
      expect.stringContaining("Fix login bug"),
      "tasks",
      "/tasks",
      "View Action Items",
      expect.any(Object),
    );
    expect(mockItem.reminderSent.overdue).toBe(true);
    expect(mockItem.save).toHaveBeenCalled();
  });

  it("should not resend duplicate reminders if already sent", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const dueDate = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const mockItem = {
      _id: new mongoose.Types.ObjectId(),
      text: "Update documentation",
      owner: userId.toString(),
      status: "open",
      dueDate,
      remindersEnabled: true,
      reminderSent: { upcoming: true, overdue: true },
      organization: orgId,
      sourceMeetingId: { _id: "m3", title: "Docs Review", organizer: userId },
      save: jest.fn().mockResolvedValue(true),
    };

    const mockPopulate = jest.fn().mockResolvedValue([mockItem]);
    jest.spyOn(ActionItem, "find").mockReturnValue({ populate: mockPopulate });

    const result = await processActionItemReminders({
      organization: orgId.toString(),
    });

    expect(result.upcomingCount).toBe(0);
    expect(result.overdueCount).toBe(0);
    expect(createNotification).not.toHaveBeenCalled();
    expect(mockItem.save).not.toHaveBeenCalled();
  });
});
