import { describe, it, expect, beforeEach, vi } from "vitest";
import { knowledgeApi } from "../knowledgeApi.js";
import apiClient from "../apiClient.js";

vi.mock("../apiClient.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe("knowledgeApi - Archive Browser queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should format getDecisions query correctly with archived options", async () => {
    apiClient.get.mockResolvedValue({ data: { success: true, decisions: [] } });

    await knowledgeApi.getDecisions("createdAt", null, {
      includeArchived: true,
      lifecycleState: "archived",
      search: "financial decision",
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining("/api/knowledge/decisions?sortBy=createdAt"),
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining("includeArchived=true"),
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining("lifecycleState=archived"),
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining("search=financial%20decision"),
    );
  });

  it("should format getActionItems query correctly with archived options", async () => {
    apiClient.get.mockResolvedValue({
      data: { success: true, actionItems: [] },
    });

    await knowledgeApi.getActionItems("all", "createdAt", {
      includeArchived: true,
      lifecycleState: "archived",
      search: "tax audit",
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/knowledge/action-items?status=all&sortBy=createdAt",
      ),
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining("includeArchived=true"),
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining("lifecycleState=archived"),
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining("search=tax%20audit"),
    );
  });

  it("should call updateMemoryLifecycleState to restore an archived memory", async () => {
    apiClient.patch.mockResolvedValue({ data: { success: true } });

    await knowledgeApi.updateMemoryLifecycleState(
      "decision",
      "dec123",
      "active",
      "Restored from archive browser",
    );

    expect(apiClient.patch).toHaveBeenCalledWith(
      "/api/knowledge/decision/dec123/lifecycle",
      {
        state: "active",
        reason: "Restored from archive browser",
      },
    );
  });
});
