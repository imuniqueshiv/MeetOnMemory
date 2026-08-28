import { checkActionItemReminders } from "../services/actionItemReminderService.js";
import { createNotification } from "../services/notificationService.js";

jest.mock("../services/notificationService.js", () => ({
  createNotification: jest.fn(),
  createNotifications: jest.fn(),
}));

jest.mock("../models/actionItemModel.js", () => ({
  __esModule: true,
  default: {
    find: jest.fn().mockResolvedValue([
      {
        _id: "test-task-1",
        text: "Test task",
        assignee: { _id: "user-1", email: "user@test.com" },
        dueDate: new Date(Date.now() + 86400000), // tomorrow
        reminderSent: {},
      },
    ]),
    updateMany: jest.fn(),
  },
}));

describe("Deep link repairs", () => {
  it("uses proper /followup/tasks/:id link instead of /tasks", async () => {
    await checkActionItemReminders();
    expect(createNotification).toHaveBeenCalled();
    const callArgs = createNotification.mock.calls[0];
    const actionUrl = callArgs[4];
    expect(actionUrl).toBe("/followup/tasks/test-task-1");
  });
});
