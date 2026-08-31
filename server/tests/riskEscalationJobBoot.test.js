import { describe, it, expect, afterEach } from "vitest";
import {
  startRiskEscalationJob,
  stopRiskEscalationJob,
  isRiskEscalationJobInitialized,
} from "../jobs/riskEscalationJob.js";

describe("Risk Escalation Job Boot & Shutdown (#2637)", () => {
  afterEach(() => {
    stopRiskEscalationJob();
  });

  it("should initialize the Risk Escalation job on start", () => {
    expect(isRiskEscalationJobInitialized()).toBe(false);

    startRiskEscalationJob();

    expect(isRiskEscalationJobInitialized()).toBe(true);
  });

  it("should prevent duplicate initialization when start is called multiple times", () => {
    startRiskEscalationJob();
    expect(isRiskEscalationJobInitialized()).toBe(true);

    // Call start again — should not throw and remains initialized
    startRiskEscalationJob();
    expect(isRiskEscalationJobInitialized()).toBe(true);
  });

  it("should stop the Risk Escalation job cleanly on graceful shutdown", () => {
    startRiskEscalationJob();
    expect(isRiskEscalationJobInitialized()).toBe(true);

    stopRiskEscalationJob();

    expect(isRiskEscalationJobInitialized()).toBe(false);
  });

  it("should handle stopping when job is not initialized", () => {
    expect(isRiskEscalationJobInitialized()).toBe(false);

    expect(() => stopRiskEscalationJob()).not.toThrow();
    expect(isRiskEscalationJobInitialized()).toBe(false);
  });
});
