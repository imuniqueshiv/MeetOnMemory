import { describe, it, expect, vi, beforeEach } from "vitest";
import cron from "node-cron";
import startPollExpirationJob from "../jobs/pollExpirationJob.js";

vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn(),
  },
}));

describe("Poll Expiration Background Job Startup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers cron job on start and avoids duplicate schedules", () => {
    const mockIo = {};

    // Initial startup
    startPollExpirationJob(mockIo);

    expect(cron.schedule).toHaveBeenCalledTimes(1);
    expect(cron.schedule).toHaveBeenCalledWith(
      "*/5 * * * *",
      expect.any(Function),
    );

    // Duplicate startup call
    startPollExpirationJob(mockIo);

    // Should not increase schedule registration count
    expect(cron.schedule).toHaveBeenCalledTimes(1);
  });
});
