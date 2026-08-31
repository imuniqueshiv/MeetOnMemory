import { describe, it, expect, vi, beforeEach } from "vitest";
import { deliverStandupReport } from "../standupReportJob.js";
import EmailService from "../../services/EmailService.js";
import { sendSlackNotification } from "../../services/slackService.js";
import User from "../../models/userModel.js";

vi.mock("../../services/EmailService.js", () => ({
  default: {
    sendNotificationEmail: vi.fn().mockResolvedValue(),
  },
}));

vi.mock("../../services/slackService.js", () => ({
  sendSlackNotification: vi.fn().mockResolvedValue(),
}));

vi.mock("../../models/userModel.js", () => ({
  default: {
    findById: vi.fn(),
  },
}));

describe("StandupReportJob Delivery Channels (Issue #2639)", () => {
  const mockUser = {
    _id: "user123",
    name: "Jane Doe",
    email: "jane@example.com",
  };

  const mockReport = {
    _id: "report123",
    aiSummary: "Completed sprint tasks and aligned on roadmap.",
    completedActionItems: [{ text: "Fix auth bug" }],
    upcomingActionItems: [{ text: "Write tests" }],
    blockers: [{ text: "Waiting for API specs" }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    User.findById.mockResolvedValue(mockUser);
  });

  it("1. Email preference triggers EmailService.sendNotificationEmail", async () => {
    const pref = {
      user: "user123",
      organization: "org123",
      scheduleType: "daily",
      deliveryChannels: ["email"],
    };

    await deliverStandupReport(pref, mockReport);

    expect(User.findById).toHaveBeenCalledWith("user123");
    expect(EmailService.sendNotificationEmail).toHaveBeenCalledTimes(1);
    expect(EmailService.sendNotificationEmail).toHaveBeenCalledWith(
      "jane@example.com",
      expect.stringContaining("Daily Standup Report"),
      expect.stringContaining("Completed sprint tasks"),
    );
    expect(sendSlackNotification).not.toHaveBeenCalled();
  });

  it("2. Slack preference triggers sendSlackNotification", async () => {
    const pref = {
      user: "user123",
      organization: "org123",
      scheduleType: "daily",
      deliveryChannels: ["slack"],
    };

    await deliverStandupReport(pref, mockReport);

    expect(sendSlackNotification).toHaveBeenCalledTimes(1);
    expect(sendSlackNotification).toHaveBeenCalledWith(
      "org123",
      expect.stringContaining("Daily Standup Report for Jane Doe"),
    );
    expect(EmailService.sendNotificationEmail).not.toHaveBeenCalled();
  });

  it("3. Both email and slack preferences trigger both deliveries", async () => {
    const pref = {
      user: "user123",
      organization: "org123",
      scheduleType: "weekly",
      deliveryChannels: ["email", "slack"],
    };

    await deliverStandupReport(pref, mockReport);

    expect(EmailService.sendNotificationEmail).toHaveBeenCalledTimes(1);
    expect(sendSlackNotification).toHaveBeenCalledTimes(1);
    expect(EmailService.sendNotificationEmail).toHaveBeenCalledWith(
      "jane@example.com",
      expect.stringContaining("Weekly Standup Report"),
      expect.any(String),
    );
    expect(sendSlackNotification).toHaveBeenCalledWith(
      "org123",
      expect.stringContaining("Weekly Standup Report for Jane Doe"),
    );
  });

  it("4. No delivery channels (or only in-app) trigger neither notifier", async () => {
    const pref = {
      user: "user123",
      organization: "org123",
      scheduleType: "daily",
      deliveryChannels: ["in-app"],
    };

    await deliverStandupReport(pref, mockReport);

    expect(EmailService.sendNotificationEmail).not.toHaveBeenCalled();
    expect(sendSlackNotification).not.toHaveBeenCalled();
  });

  it("5. Email notifier failure is handled gracefully", async () => {
    const pref = {
      user: "user123",
      organization: "org123",
      scheduleType: "daily",
      deliveryChannels: ["email"],
    };
    EmailService.sendNotificationEmail.mockRejectedValueOnce(
      new Error("SMTP Connection Failed"),
    );

    await expect(deliverStandupReport(pref, mockReport)).resolves.not.toThrow();
    expect(EmailService.sendNotificationEmail).toHaveBeenCalledTimes(1);
  });

  it("6. Slack notifier failure is handled gracefully", async () => {
    const pref = {
      user: "user123",
      organization: "org123",
      scheduleType: "daily",
      deliveryChannels: ["slack"],
    };
    sendSlackNotification.mockRejectedValueOnce(new Error("Slack Rate Limit"));

    await expect(deliverStandupReport(pref, mockReport)).resolves.not.toThrow();
    expect(sendSlackNotification).toHaveBeenCalledTimes(1);
  });

  it("7. Email failure does not prevent Slack delivery when both are configured", async () => {
    const pref = {
      user: "user123",
      organization: "org123",
      scheduleType: "daily",
      deliveryChannels: ["email", "slack"],
    };
    EmailService.sendNotificationEmail.mockRejectedValueOnce(
      new Error("SMTP Timeout"),
    );

    await deliverStandupReport(pref, mockReport);

    expect(EmailService.sendNotificationEmail).toHaveBeenCalledTimes(1);
    expect(sendSlackNotification).toHaveBeenCalledTimes(1);
  });

  it("8. Slack failure does not prevent email delivery when both are configured", async () => {
    const pref = {
      user: "user123",
      organization: "org123",
      scheduleType: "daily",
      deliveryChannels: ["email", "slack"],
    };
    sendSlackNotification.mockRejectedValueOnce(
      new Error("Slack Integration Disconnected"),
    );

    await deliverStandupReport(pref, mockReport);

    expect(EmailService.sendNotificationEmail).toHaveBeenCalledTimes(1);
    expect(sendSlackNotification).toHaveBeenCalledTimes(1);
  });

  it("9. Correct report content (summary, items, blockers) is formatted", async () => {
    const pref = {
      user: "user123",
      organization: "org123",
      scheduleType: "daily",
      deliveryChannels: ["email"],
    };

    await deliverStandupReport(pref, mockReport);

    const description = EmailService.sendNotificationEmail.mock.calls[0][2];
    expect(description).toContain("Completed sprint tasks");
    expect(description).toContain("- Fix auth bug");
    expect(description).toContain("- Write tests");
    expect(description).toContain("- Waiting for API specs");
  });

  it("10. Correct recipient, user, and organization parameters are passed", async () => {
    const pref = {
      user: "user123",
      organization: "org123",
      scheduleType: "daily",
      deliveryChannels: ["email", "slack"],
    };

    await deliverStandupReport(pref, mockReport);

    expect(EmailService.sendNotificationEmail).toHaveBeenCalledWith(
      "jane@example.com",
      expect.any(String),
      expect.any(String),
    );
    expect(sendSlackNotification).toHaveBeenCalledWith(
      "org123",
      expect.any(String),
    );
  });
});
