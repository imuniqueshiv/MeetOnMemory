import { describe, it, expect, vi, afterEach } from "vitest";
import queueRegistry from "../services/queueRegistry.js";
import {
  registerTopicIntelligenceJob,
  runTopicIntelligenceJob,
} from "../jobs/topicIntelligenceJob.js";
import { startWorkers } from "../config/workers.js";
import Organization from "../models/organizationModel.js";
import * as topicIntelligenceService from "../services/topicIntelligenceService.js";

describe("topicIntelligenceJob Worker Registration & Startup (#2638)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    queueRegistry.reset();
  });

  it("should register the topicIntelligence queue with queueRegistry", () => {
    registerTopicIntelligenceJob();

    expect(queueRegistry.listQueues()).toContain("topicIntelligence");
  });

  it("should handle duplicate registration calls without error", () => {
    expect(() => {
      registerTopicIntelligenceJob();
      registerTopicIntelligenceJob();
    }).not.toThrow();

    expect(queueRegistry.listQueues()).toContain("topicIntelligence");
  });

  it("should include Topic Intelligence Worker when startWorkers is executed", async () => {
    const { started, failed } = await startWorkers(null);

    expect(started).toContain("Topic Intelligence Worker");
    expect(failed).toEqual([]);
    expect(queueRegistry.listQueues()).toContain("topicIntelligence");
  });

  it("should process pending topic intelligence work for active organizations", async () => {
    const mockOrg = { _id: "org_active_123", status: "active" };

    vi.spyOn(Organization, "find").mockResolvedValue([mockOrg]);
    const calculateWeeklyTrendsSpy = vi
      .spyOn(topicIntelligenceService, "calculateWeeklyTrends")
      .mockResolvedValue();
    const detectOrphanedTopicsSpy = vi
      .spyOn(topicIntelligenceService, "detectOrphanedTopics")
      .mockResolvedValue();
    const buildCoOccurrenceGraphSpy = vi
      .spyOn(topicIntelligenceService, "buildCoOccurrenceGraph")
      .mockResolvedValue();

    await runTopicIntelligenceJob();

    expect(Organization.find).toHaveBeenCalledWith({ status: "active" });
    expect(calculateWeeklyTrendsSpy).toHaveBeenCalledWith("org_active_123");
    expect(detectOrphanedTopicsSpy).toHaveBeenCalledWith("org_active_123");
    expect(buildCoOccurrenceGraphSpy).toHaveBeenCalledWith("org_active_123");
  });
});
