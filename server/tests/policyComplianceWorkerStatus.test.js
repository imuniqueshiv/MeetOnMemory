// server/tests/policyComplianceWorkerStatus.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  reEvaluateCompliance,
  getPolicyComplianceWorkerStatus,
} from "../controllers/policyComplianceController.js";
import PolicyCompliance from "../models/policyComplianceModel.js";
import {
  policyComplianceRetryQueue,
  getQueueInstance,
} from "../services/queueService.js";

vi.mock("../models/policyComplianceModel.js");
vi.mock("../services/queueService.js");

describe("Policy Compliance Worker Status (#2652)", () => {
  let req, res;
  const flagId = "flag_123";
  const organizationId = "org_456";

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      body: { flagId },
      user: {
        id: "user_789",
        organization: organizationId,
      },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    PolicyCompliance.findOne.mockResolvedValue({
      _id: flagId,
      classification: "unclassified",
      organization: organizationId,
    });
  });

  describe("reEvaluateCompliance", () => {
    it("returns 503 with detailed message when worker is inactive", async () => {
      policyComplianceRetryQueue.isActive = false;

      await reEvaluateCompliance(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.success).toBe(false);
      expect(responseBody.message).toContain("worker is temporarily unavailable");
      expect(responseBody.data.workerStatus).toBe("inactive");
      expect(responseBody.data.retryable).toBe(true);
    });

    it("includes workerStatus: active in response when queue is available", async () => {
      policyComplianceRetryQueue.isActive = true;
      policyComplianceRetryQueue.add = vi
        .fn()
        .mockResolvedValue({ id: "job_123" });

      await reEvaluateCompliance(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.workerStatus).toBe("active");
      expect(responseBody.data.queued).toBe(true);
    });
  });

  describe("getPolicyComplianceWorkerStatus", () => {
    it("returns active status when worker is available", async () => {
      policyComplianceRetryQueue.isActive = true;

      const queueMock = {
        getJobCounts: vi
          .fn()
          .mockResolvedValue({
            waiting: 5,
            active: 1,
            completed: 100,
            failed: 2,
            delayed: 0,
          }),
      };

      getQueueInstance.mockReturnValue(queueMock);

      await getPolicyComplianceWorkerStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.workerActive).toBe(true);
      expect(responseBody.data.status).toBe("active");
      expect(responseBody.data.jobCounts.waiting).toBe(5);
      expect(responseBody.data.jobCounts.active).toBe(1);
    });

    it("returns inactive status and recovery message when worker is unavailable", async () => {
      policyComplianceRetryQueue.isActive = false;
      getQueueInstance.mockReturnValue(null);

      await getPolicyComplianceWorkerStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.workerActive).toBe(false);
      expect(responseBody.data.status).toBe("inactive");
      expect(responseBody.data.message).toContain("unavailable");
      expect(responseBody.data.message).toContain("queued");
    });

    it("gracefully handles queue stats failures", async () => {
      policyComplianceRetryQueue.isActive = true;

      const queueMock = {
        getJobCounts: vi
          .fn()
          .mockRejectedValue(new Error("Redis connection lost")),
      };

      getQueueInstance.mockReturnValue(queueMock);

      await getPolicyComplianceWorkerStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.workerActive).toBe(true);
      // Should return zeros when fetch fails
      expect(responseBody.data.jobCounts.waiting).toBe(0);
    });
  });
});