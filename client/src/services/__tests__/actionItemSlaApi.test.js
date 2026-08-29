import { beforeEach, describe, expect, it, vi } from "vitest";

import apiClient from "../apiClient";
import {
  getSlaConfig,
  updateSlaConfig,
  getSlaBreaches,
  getSlaComplianceStats,
  acknowledgeBreach,
} from "../actionItemSlaApi";

vi.mock("../apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("actionItemSlaApi endpoint contract (#2655)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the canonical /api prefix for getSLAConfig", async () => {
    apiClient.get.mockResolvedValue({ data: { data: {} } });

    await getSlaConfig("org-123");

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/action-item-sla/config/org-123",
    );
  });

  it("uses the canonical /api prefix for updateSlaConfig", async () => {
    apiClient.put.mockResolvedValue({ data: { data: {} } });

    await updateSlaConfig("org-123", { defaultSlaHours: 24 });

    expect(apiClient.put).toHaveBeenCalledWith(
      "/api/action-item-sla/config/org-123",
      { defaultSlaHours: 24 },
    );
  });

  it("uses the canonical /api prefix for getSlaBreaches with params", async () => {
    apiClient.get.mockResolvedValue({ data: { data: [] } });

    await getSlaBreaches("org-123", { status: "active" });

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/action-item-sla/breaches/org-123",
      { params: { status: "active" } },
    );
  });

  it("uses the canonical /api prefix for getSlaBreaches without params", async () => {
    apiClient.get.mockResolvedValue({ data: { data: [] } });

    await getSlaBreaches("org-123");

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/action-item-sla/breaches/org-123",
      { params: {} },
    );
  });

  it("uses the canonical /api prefix for getSlaComplianceStats", async () => {
    apiClient.get.mockResolvedValue({ data: { data: {} } });

    await getSlaComplianceStats("org-123");

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/action-item-sla/stats/org-123",
    );
  });

  it("uses the canonical /api prefix for acknowledgeBreach", async () => {
    apiClient.post.mockResolvedValue({ data: { data: {} } });

    await acknowledgeBreach("breach-456");

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/action-item-sla/breach/breach-456/acknowledge",
    );
  });
});
